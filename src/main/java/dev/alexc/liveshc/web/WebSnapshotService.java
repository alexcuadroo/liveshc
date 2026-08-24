package dev.alexc.liveshc.web;

import dev.alexc.liveshc.Main;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.OfflinePlayer;
import org.bukkit.Statistic;
import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitTask;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/** Publishes a read-only projection of plugin data. Bukkit state is captured on the server thread. */
public final class WebSnapshotService {
    private static final int MAX_ATTEMPTS = 3;

    private final Main plugin;
    private final HttpClient client;
    private boolean enabled;
    private URI endpoint;
    private String token;
    private String serverId;
    private BukkitTask periodicTask;

    public WebSnapshotService(Main plugin) {
        this.plugin = plugin;
        this.client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
    }

    public void start() {
        enabled = plugin.getConfig().getBoolean("web.habilitada", false);
        if (!enabled) {
            plugin.getLogger().info("Sincronización web deshabilitada.");
            return;
        }

        token = plugin.getConfig().getString("web.token", "").trim();
        serverId = plugin.getConfig().getString("web.server-id", "principal").trim();
        int interval = Math.max(10, plugin.getConfig().getInt("web.intervalo-segundos", 30));
        try {
            endpoint = URI.create(plugin.getConfig().getString("web.api-url", ""));
            if (endpoint.getScheme() == null || token.isEmpty() || serverId.isEmpty()) {
                throw new IllegalArgumentException("faltan URL, token o server-id");
            }
        } catch (RuntimeException exception) {
            enabled = false;
            plugin.getLogger().severe("Configuración web inválida: " + exception.getMessage());
            return;
        }

        publishAll(true);
        periodicTask = Bukkit.getScheduler().runTaskTimer(plugin, () -> publishAll(false),
                interval * 20L, interval * 20L);
    }

    public void stop() {
        if (!enabled) return;
        if (periodicTask != null) periodicTask.cancel();
        send(captureAll(false, true), 1);
        enabled = false;
    }

    public void reload() {
        stop();
        start();
    }

    public void publishAll(boolean resetOnline) {
        if (enabled) send(captureAll(resetOnline, false), 1);
    }

    public void publishPlayer(Player player, boolean online) {
        if (!enabled) return;
        Instant capturedAt = Instant.now();
        PlayerState state = capturePlayer(player, online, capturedAt);
        send(encode(List.of(state), false, false, capturedAt), 1);
    }

    private String captureAll(boolean resetOnline, boolean shuttingDown) {
        Instant capturedAt = Instant.now();
        Map<UUID, PlayerState> states = new LinkedHashMap<>();
        for (Map.Entry<UUID, Integer> entry : plugin.getLivesManager().getKnownIndividualLives().entrySet()) {
            OfflinePlayer offline = Bukkit.getOfflinePlayer(entry.getKey());
            states.put(entry.getKey(), PlayerState.offline(entry.getKey(), offline.getName(), entry.getValue()));
        }
        for (Player player : Bukkit.getOnlinePlayers()) {
            states.put(player.getUniqueId(), capturePlayer(player, !shuttingDown, capturedAt));
        }
        return encode(new ArrayList<>(states.values()), resetOnline, shuttingDown, capturedAt);
    }

    private PlayerState capturePlayer(Player player, boolean online, Instant capturedAt) {
        Location location = player.getLocation();
        return new PlayerState(player.getUniqueId(), player.getName(),
                plugin.getLivesManager().getLives(player.getUniqueId(), false),
                Math.max(0L, player.getStatistic(Statistic.PLAY_ONE_MINUTE) / 20L), online,
                location.getWorld().getKey().toString(), location.getWorld().getEnvironment().name(),
                location.getX(), location.getY(), location.getZ(), capturedAt,
                Math.max(0, player.getLevel()), Math.max(0L, player.getTotalExperience()),
                Math.max(0L, player.getStatistic(Statistic.WALK_ONE_CM)), blocksMined(player),
                Math.max(0L, player.getStatistic(Statistic.MOB_KILLS)));
    }

    private static long blocksMined(Player player) {
        long total = 0L;
        for (Material material : Material.values()) {
            if (material.isBlock()) {
                total += Math.max(0, player.getStatistic(Statistic.MINE_BLOCK, material));
            }
        }
        return total;
    }

    private String encode(List<PlayerState> players, boolean resetOnline, boolean shuttingDown, Instant capturedAt) {
        StringBuilder json = new StringBuilder(512).append('{')
                .append("\"serverId\":").append(quote(serverId)).append(',')
                .append("\"capturedAt\":").append(quote(capturedAt.toString())).append(',')
                .append("\"resetOnline\":").append(resetOnline || shuttingDown).append(',')
                .append("\"noLivesCommandExecutions\":")
                .append(plugin.getRecordsManager().getNoLivesCommandExecutions()).append(',')
                .append("\"livesMode\":").append(quote(plugin.isSharedLivesEnabled() ? "shared" : "individual")).append(',')
                .append("\"sharedLives\":");
        Integer shared = plugin.getLivesManager().getStoredSharedLives();
        json.append(shared == null ? "null" : shared).append(",\"players\":[");
        for (int index = 0; index < players.size(); index++) {
            if (index > 0) json.append(',');
            players.get(index).appendJson(json);
        }
        return json.append("]}").toString();
    }

    private void send(String body, int attempt) {
        HttpRequest request = HttpRequest.newBuilder(endpoint)
                .timeout(Duration.ofSeconds(8))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
        client.sendAsync(request, HttpResponse.BodyHandlers.discarding())
                .thenCompose(response -> response.statusCode() >= 200 && response.statusCode() < 300
                        ? CompletableFuture.<Void>completedFuture(null)
                        : CompletableFuture.<Void>failedFuture(new IllegalStateException("HTTP " + response.statusCode())))
                .exceptionallyCompose(error -> retry(body, attempt, error));
    }

    private CompletableFuture<Void> retry(String body, int attempt, Throwable error) {
        if (attempt >= MAX_ATTEMPTS || !enabled) {
            plugin.getLogger().warning("No se pudo sincronizar la web: " + error.getMessage());
            return CompletableFuture.completedFuture(null);
        }
        return CompletableFuture.runAsync(() -> { },
                        CompletableFuture.delayedExecutor(attempt * 2L, TimeUnit.SECONDS))
                .thenRun(() -> send(body, attempt + 1));
    }

    private static String quote(String value) {
        if (value == null) return "null";
        StringBuilder escaped = new StringBuilder(value.length() + 2).append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> escaped.append("\\\"");
                case '\\' -> escaped.append("\\\\");
                case '\n' -> escaped.append("\\n");
                case '\r' -> escaped.append("\\r");
                case '\t' -> escaped.append("\\t");
                default -> escaped.append(c < 0x20 ? String.format("\\u%04x", (int) c) : c);
            }
        }
        return escaped.append('"').toString();
    }

    private record PlayerState(UUID uuid, String name, int individualLives, Long playTimeSeconds,
                               boolean online, String world, String dimension, Double x, Double y, Double z,
                               Instant lastSeenAt, Integer level, Long totalExperience, Long walkedCentimeters,
                               Long blocksMined, Long mobKills) {
        static PlayerState offline(UUID uuid, String name, int lives) {
            return new PlayerState(uuid, name, lives, null, false, null, null, null, null, null,
                    null, null, null, null, null, null);
        }

        void appendJson(StringBuilder json) {
            json.append('{').append("\"uuid\":").append(quote(uuid.toString()))
                    .append(",\"name\":").append(quote(name))
                    .append(",\"individualLives\":").append(individualLives)
                    .append(",\"playTimeSeconds\":").append(playTimeSeconds == null ? "null" : playTimeSeconds)
                    .append(",\"online\":").append(online)
                    .append(",\"world\":").append(quote(world))
                    .append(",\"dimension\":").append(quote(dimension))
                    .append(",\"x\":").append(x == null ? "null" : x)
                    .append(",\"y\":").append(y == null ? "null" : y)
                    .append(",\"z\":").append(z == null ? "null" : z)
                    .append(",\"lastSeenAt\":").append(lastSeenAt == null ? "null" : quote(lastSeenAt.toString()))
                    .append(",\"level\":").append(level == null ? "null" : level)
                    .append(",\"totalExperience\":").append(totalExperience == null ? "null" : totalExperience)
                    .append(",\"walkedCentimeters\":").append(walkedCentimeters == null ? "null" : walkedCentimeters)
                    .append(",\"blocksMined\":").append(blocksMined == null ? "null" : blocksMined)
                    .append(",\"mobKills\":").append(mobKills == null ? "null" : mobKills).append('}');
        }
    }
}
