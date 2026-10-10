package dev.alexc.liveshc.listener;

import dev.alexc.liveshc.Main;
import dev.alexc.liveshc.storage.LivesManager.LifeChange;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;

public final class PlayerLivesListener implements Listener {
    private final Main plugin;

    public PlayerLivesListener(Main plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        plugin.getLivesManager().ensurePlayer(player.getUniqueId());
        plugin.getWebSnapshotService().publishPlayer(player, true);
        // Si entró con 0 vidas (por un comando sin vidas que falló), se reintenta.
        if (plugin.getLives(player.getUniqueId()) == 0) {
            plugin.handleLivesDepleted(player.getUniqueId(), player.getName(), plugin.isSharedLivesEnabled());
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerDeath(PlayerDeathEvent event) {
        Player player = event.getEntity();
        LifeChange change = plugin.getLivesManager().recordDeath(player.getUniqueId());
        plugin.getWebSnapshotService().publishPlayer(player, true);
        plugin.getDeathDuelDisplay().show(event);
        if (plugin.isDebugEnabled()) {
            plugin.getLogger().info("[debug] " + player.getName() + " murió: " + change.previous()
                    + " -> " + change.current() + " vidas.");
        }
        if (change.reachedZero()) {
            plugin.handleLivesDepleted(player.getUniqueId(), player.getName(), change.shared());
        } else if (change.previous() == 0) {
            // Ya estaba en 0: se reintenta el comando sin vidas que antes no se despachó.
            plugin.handleLivesDepleted(player.getUniqueId(), player.getName(), change.shared());
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        plugin.getWebSnapshotService().publishPlayer(event.getPlayer(), false);
    }
}
