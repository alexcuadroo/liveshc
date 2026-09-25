package uy.edualex.hardcoresounds.service;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;
import net.kyori.adventure.resource.ResourcePackInfo;
import net.kyori.adventure.resource.ResourcePackRequest;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import uy.edualex.hardcoresounds.config.PluginSettings;

public final class ResourcePackService {
    private final Logger logger;
    private final Map<UUID, String> states = new ConcurrentHashMap<>();
    private volatile PluginSettings settings;

    public ResourcePackService(Logger logger, PluginSettings settings) {
        this.logger = logger;
        this.settings = settings;
    }

    public void replaceSettings(PluginSettings settings) {
        this.settings = settings;
    }

    public void send(Player player) {
        PluginSettings current = settings;
        if (!current.packEnabled()) return;
        Optional<PluginSettings.PackProfile> selected = current.profileFor(Bukkit.getMinecraftVersion());
        if (selected.isEmpty()) {
            logger.warning("No valid resource-pack profile for Minecraft " + Bukkit.getMinecraftVersion() + "; pack not sent to " + player.getName() + '.');
            return;
        }
        PluginSettings.PackProfile profile = selected.get();
        ResourcePackInfo info = ResourcePackInfo.resourcePackInfo(profile.uuid(), profile.uri(), profile.sha1());
        ResourcePackRequest request = ResourcePackRequest.resourcePackRequest()
                .packs(info)
                .required(current.packRequired())
                .prompt(current.packPrompt())
                .callback((uuid, status, audience) -> {
                    states.put(player.getUniqueId(), status.name());
                    logger.fine("Resource pack for " + player.getName() + ": " + status.name());
                })
                .build();
        player.sendResourcePacks(request);
    }

    public Optional<String> state(UUID playerId) {
        return Optional.ofNullable(states.get(playerId));
    }

    public void remove(UUID playerId) {
        states.remove(playerId);
    }
}
