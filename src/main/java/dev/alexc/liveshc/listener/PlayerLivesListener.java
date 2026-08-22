package dev.alexc.liveshc.listener;

import dev.alexc.liveshc.Main;
import dev.alexc.liveshc.storage.LivesManager.LifeChange;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;

import java.util.UUID;

public final class PlayerLivesListener implements Listener {
    private final Main plugin;

    public PlayerLivesListener(Main plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerJoin(PlayerJoinEvent event) {
        plugin.getLivesManager().ensurePlayer(event.getPlayer().getUniqueId());
        plugin.getWebSnapshotService().publishPlayer(event.getPlayer(), true);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerDeath(PlayerDeathEvent event) {
        Player player = event.getEntity();
        LifeChange change = plugin.getLivesManager().removeLife(player.getUniqueId());
        plugin.getWebSnapshotService().publishPlayer(player, true);
        if (change.reachedZero()) {
            scheduleNoLivesCommand(player.getUniqueId(), player.getName(), change.shared());
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        plugin.getWebSnapshotService().publishPlayer(event.getPlayer(), false);
    }

    private void scheduleNoLivesCommand(UUID playerId, String playerName, boolean shared) {
        String command = plugin.getNoLivesCommand().trim();
        if (command.startsWith("/")) {
            command = command.substring(1).trim();
        }
        if (command.isEmpty()) {
            plugin.getLogger().severe("comando-sin-vidas está vacío; no se ejecutó ninguna acción para "
                    + playerName + ".");
            return;
        }

        String parsedCommand = command.replace("%player%", playerName);
        long delayTicks = plugin.getNoLivesCommandDelaySeconds() * 20L;
        if (delayTicks == 0L) {
            executeNoLivesCommand(playerId, parsedCommand, shared);
            return;
        }

        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            if (plugin.getLivesManager().getLives(playerId, shared) == 0) {
                executeNoLivesCommand(playerId, parsedCommand, shared);
            }
        }, delayTicks);
    }

    private void executeNoLivesCommand(UUID playerId, String parsedCommand, boolean shared) {
        boolean dispatched = Bukkit.dispatchCommand(Bukkit.getConsoleSender(), parsedCommand);
        if (dispatched) {
            plugin.getRecordsManager().recordNoLivesCommandExecution();
            plugin.getLivesManager().resetLives(playerId, shared);
            plugin.getWebSnapshotService().publishAll(false);
        } else {
            plugin.getLogger().warning("El comando sin vidas no fue reconocido: " + parsedCommand);
        }
    }
}
