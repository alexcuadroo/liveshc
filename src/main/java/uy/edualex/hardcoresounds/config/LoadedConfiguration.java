package uy.edualex.hardcoresounds.config;

import java.util.Map;
import uy.edualex.hardcoresounds.model.CustomSound;

public record LoadedConfiguration(PluginSettings settings, Map<String, CustomSound> sounds) {
    public LoadedConfiguration {
        sounds = Map.copyOf(sounds);
    }
}
