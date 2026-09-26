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
        plugin.getLivesManager().ensurePlayer(event.getPlayer().getUniqueId());
        plugin.getWebSnapshotService().publishPlayer(event.getPlayer(), true);
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerDeath(PlayerDeathEvent event) {
        Player player = event.getEntity();
        LifeChange change = plugin.getLivesManager().recordDeath(player.getUniqueId());
        plugin.getWebSnapshotService().publishPlayer(player, true);
        plugin.getDeathDuelDisplay().show(event);
        if (change.reachedZero()) {
            plugin.handleLivesDepleted(player.getUniqueId(), player.getName(), change.shared());
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onPlayerQuit(PlayerQuitEvent event) {
        plugin.getWebSnapshotService().publishPlayer(event.getPlayer(), false);
    }
}
