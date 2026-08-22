package dev.alexc.liveshc;

import org.bukkit.plugin.java.JavaPlugin;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public final class UpdateChecker {
    private static final String GITHUB_API_URL =
            "https://api.github.com/repos/alexcuadroo/liveshc/releases/latest";
    private static final String RELEASES_URL =
            "https://github.com/alexcuadroo/liveshc/releases/tag/";

    private final JavaPlugin plugin;

    public UpdateChecker(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    public void checkForUpdates() {
        plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
            HttpURLConnection connection = null;
            try {
                URL url = URI.create(GITHUB_API_URL).toURL();
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("GET");
                connection.setRequestProperty("Accept", "application/vnd.github+json");
                connection.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
                connection.setRequestProperty("User-Agent", plugin.getName() + "/" + plugin.getDescription().getVersion());
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(5000);

                int responseCode = connection.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    plugin.getLogger().warning("No se pudo verificar actualizaciones (HTTP " + responseCode + ").");
                    return;
                }

                StringBuilder response = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                        connection.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                }

                String latestTag = parseTagName(response.toString());
                if (latestTag == null) {
                    plugin.getLogger().warning("No se pudo obtener la versión más reciente de GitHub.");
                    return;
                }

                String latestVersion = normalizeVersion(latestTag);
                String currentVersion = normalizeVersion(plugin.getDescription().getVersion());
                if (!currentVersion.equalsIgnoreCase(latestVersion)) {
                    plugin.getLogger().info("========================================");
                    plugin.getLogger().info("¡Nueva versión disponible! " + currentVersion + " -> " + latestVersion);
                    plugin.getLogger().info("Descárgala en: " + RELEASES_URL + latestTag);
                    plugin.getLogger().info("========================================");
                }
            } catch (Exception exception) {
                plugin.getLogger().warning("Error al verificar actualizaciones: " + exception.getMessage());
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        });
    }

    private String normalizeVersion(String version) {
        if (version.startsWith("v.") || version.startsWith("V.")) {
            return version.substring(2);
        }
        if (version.startsWith("v") || version.startsWith("V")) {
            return version.substring(1);
        }
        return version;
    }

    private String parseTagName(String json) {
        String key = "\"tag_name\"";
        int index = json.indexOf(key);
        if (index == -1) return null;
        int colonIndex = json.indexOf(':', index + key.length());
        if (colonIndex == -1) return null;
        int firstQuote = json.indexOf('"', colonIndex + 1);
        if (firstQuote == -1) return null;
        int secondQuote = json.indexOf('"', firstQuote + 1);
        if (secondQuote == -1) return null;
        return json.substring(firstQuote + 1, secondQuote);
    }
}
