package uy.edualex.hardcoresounds.config;

import java.net.URI;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import net.kyori.adventure.text.Component;

public record PluginSettings(
        boolean packEnabled,
        boolean packRequired,
        Component packPrompt,
        Map<String, PackProfile> packProfiles,
        boolean notifySender,
        boolean guiEnabled,
        boolean limitsEnabled,
        long senderCooldownMillis,
        long globalCooldownMillis
) {
    public PluginSettings {
        packProfiles = Map.copyOf(packProfiles);
    }

    public Optional<PackProfile> profileFor(String minecraftVersion) {
        String[] parts = minecraftVersion.split("\\.");
        String family = parts.length >= 3 ? parts[0] + "." + parts[1] : minecraftVersion;
        return Optional.ofNullable(packProfiles.get(family));
    }

    public record PackProfile(String version, URI uri, String sha1, UUID uuid) {}
}
