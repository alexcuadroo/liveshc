package uy.edualex.hardcoresounds.config;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Logger;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.sound.Sound;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Material;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.InvalidConfigurationException;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import uy.edualex.hardcoresounds.model.CustomSound;
import uy.edualex.hardcoresounds.util.Validation;

public final class ConfigurationLoader {
    private final JavaPlugin plugin;
    private final Logger logger;
    private final MiniMessage miniMessage = MiniMessage.miniMessage();

    public ConfigurationLoader(JavaPlugin plugin) {
        this.plugin = plugin;
        this.logger = plugin.getLogger();
    }

    public LoadedConfiguration load() throws IOException, InvalidConfigurationException {
        File configFile = new File(plugin.getDataFolder(), "config.yml");
        File soundsFile = new File(plugin.getDataFolder(), "sounds.yml");
        YamlConfiguration config = loadYaml(configFile);
        YamlConfiguration soundsYaml = loadYaml(soundsFile);

        boolean generatedUuid = false;
        Map<String, PluginSettings.PackProfile> profiles = new LinkedHashMap<>();
        ConfigurationSection profileSection = requireSection(config, "resource-pack.profiles");
        Map<String, ConfigurationSection> profileSections = flattenProfileSections(profileSection);
        for (Map.Entry<String, ConfigurationSection> entry : profileSections.entrySet()) {
            String version = entry.getKey();
            ConfigurationSection profile = entry.getValue();
            String url = profile.getString("url", "").trim();
            String sha1 = profile.getString("sha1", "").trim();
            String uuidText = profile.getString("uuid", "").trim();
            if (uuidText.isEmpty()) {
                uuidText = UUID.randomUUID().toString();
                profile.set("uuid", uuidText);
                generatedUuid = true;
            }
            if (url.isEmpty() || !Validation.isSha1(sha1)) {
                if (config.getBoolean("resource-pack.enabled")) {
                    logger.warning("Resource-pack profile '" + version + "' has an empty URL or invalid SHA-1; it will not be sent.");
                }
                continue;
            }
            try {
                URI uri = URI.create(url);
                if (!uri.isAbsolute() || !("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))) {
                    throw new IllegalArgumentException("URL must use HTTP or HTTPS");
                }
                profiles.put(version, new PluginSettings.PackProfile(version, uri, sha1.toLowerCase(Locale.ROOT), UUID.fromString(uuidText)));
            } catch (IllegalArgumentException exception) {
                logger.warning("Resource-pack profile '" + version + "' is invalid: " + exception.getMessage());
            }
        }
        if (generatedUuid) config.save(configFile);

        PluginSettings settings = new PluginSettings(
                config.getBoolean("resource-pack.enabled", false),
                config.getBoolean("resource-pack.required", true),
                miniMessage.deserialize(config.getString("resource-pack.prompt", "")),
                profiles,
                config.getBoolean("general.notify-sender", true),
                config.getBoolean("general.gui-enabled", true),
                config.getBoolean("limits.enabled", true),
                Math.max(0, config.getLong("limits.per-sender-cooldown-ms", 500)),
                Math.max(0, config.getLong("limits.global-cooldown-ms", 250))
        );
        return new LoadedConfiguration(settings, loadSounds(soundsYaml));
    }

    static Map<String, ConfigurationSection> flattenProfileSections(ConfigurationSection root) {
        Map<String, ConfigurationSection> result = new LinkedHashMap<>();
        for (String major : root.getKeys(false)) {
            ConfigurationSection section = root.getConfigurationSection(major);
            if (section == null) continue;
            if (section.contains("url") || section.contains("sha1")) {
                result.put(major, section);
                continue;
            }
            for (String minor : section.getKeys(false)) {
                ConfigurationSection nested = section.getConfigurationSection(minor);
                if (nested != null && (nested.contains("url") || nested.contains("sha1"))) {
                    result.put(major + "." + minor, nested);
                }
            }
        }
        return result;
    }

    private Map<String, CustomSound> loadSounds(YamlConfiguration yaml) {
        ConfigurationSection root = yaml.getConfigurationSection("sounds");
        if (root == null) throw new IllegalArgumentException("sounds.yml must contain a 'sounds' section");
        Map<String, CustomSound> result = new LinkedHashMap<>();
        for (String rawId : root.getKeys(false)) {
            try {
                String id = Validation.normalizeId(rawId).orElseThrow(() -> new IllegalArgumentException("invalid id"));
                String base = "sounds." + rawId;
                Key key = Key.key(requireString(yaml, base + ".key"));
                Material material = Material.matchMaterial(requireString(yaml, base + ".material"));
                if (material == null || material.isAir()) throw new IllegalArgumentException("invalid material");
                double volume = yaml.getDouble(base + ".volume", 1.0);
                double pitch = yaml.getDouble(base + ".pitch", 1.0);
                if (!Validation.validVolume(volume)) throw new IllegalArgumentException("volume must be finite and >= 0");
                if (!Validation.validPitch(pitch)) throw new IllegalArgumentException("pitch must be between 0.5 and 2.0");
                Sound.Source source = Sound.Source.valueOf(requireString(yaml, base + ".source").toUpperCase(Locale.ROOT));
                Component displayName = miniMessage.deserialize(requireString(yaml, base + ".display-name"));
                List<Component> description = yaml.getStringList(base + ".description").stream().map(miniMessage::deserialize).toList();
                if (result.putIfAbsent(id, new CustomSound(id, key, displayName, material, (float) volume, (float) pitch, source, description)) != null) {
                    throw new IllegalArgumentException("duplicate normalized id");
                }
            } catch (RuntimeException exception) {
                logger.warning("Sound '" + rawId + "' ignored: " + exception.getMessage());
            }
        }
        return result;
    }

    private static YamlConfiguration loadYaml(File file) throws IOException, InvalidConfigurationException {
        YamlConfiguration yaml = new YamlConfiguration();
        yaml.load(file);
        return yaml;
    }

    private static ConfigurationSection requireSection(YamlConfiguration yaml, String path) {
        ConfigurationSection section = yaml.getConfigurationSection(path);
        if (section == null) throw new IllegalArgumentException("Missing configuration section: " + path);
        return section;
    }

    private static String requireString(YamlConfiguration yaml, String path) {
        String value = yaml.getString(path);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("missing " + path.substring(path.lastIndexOf('.') + 1));
        return value;
    }
}
