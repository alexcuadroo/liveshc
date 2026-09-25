package uy.edualex.hardcoresounds.listener;

import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import uy.edualex.hardcoresounds.service.ResourcePackService;

public final class ConnectionListener implements Listener {
    private final ResourcePackService packs;

    public ConnectionListener(ResourcePackService packs) {
        this.packs = packs;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        packs.send(event.getPlayer());
    }
}
