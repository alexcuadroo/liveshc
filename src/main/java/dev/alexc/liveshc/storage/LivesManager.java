package dev.alexc.liveshc.storage;

import dev.alexc.liveshc.Main;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public final class LivesManager {
    private static final String PLAYERS_SECTION = "players";

    private final Main plugin;
    private final File playersFile;
    private final Map<UUID, Integer> lives = new HashMap<>();
    private YamlConfiguration playersConfig;

    public LivesManager(Main plugin) {
        this.plugin = plugin;
        this.playersFile = new File(plugin.getDataFolder(), "players.yml");
    }

    public void load() {
        playersConfig = YamlConfiguration.loadConfiguration(playersFile);
        lives.clear();

        ConfigurationSection players = playersConfig.getConfigurationSection(PLAYERS_SECTION);
        if (players == null) {
            return;
        }

        for (String key : players.getKeys(false)) {
            try {
                UUID playerId = UUID.fromString(key);
                int storedLives = Math.max(0, players.getInt(key, 0));
                lives.put(playerId, storedLives);
            } catch (IllegalArgumentException exception) {
                plugin.getLogger().warning("Se ignoró un UUID inválido en players.yml: " + key);
            }
        }
    }

    public int ensurePlayer(UUID playerId) {
        Integer current = lives.get(playerId);
        if (current != null) {
            return current;
        }

        int initial = Math.min(plugin.getInitialLives(), plugin.getMaximumLives());
        lives.put(playerId, initial);
        save();
        return initial;
    }

    public int getLives(UUID playerId) {
        Integer current = lives.get(playerId);
        if (current == null) {
            return Math.min(plugin.getInitialLives(), plugin.getMaximumLives());
        }
        return Math.min(Math.max(current, 0), plugin.getMaximumLives());
    }

    public LifeChange removeLife(UUID playerId) {
        int previous = ensurePlayer(playerId);
        int current = Math.max(0, previous - 1);
        lives.put(playerId, current);
        save();
        return new LifeChange(previous, current);
    }

    public AddResult addLives(UUID playerId, int amount) {
        int previous = ensurePlayer(playerId);
        int current = (int) Math.min(plugin.getMaximumLives(), (long) previous + amount);
        lives.put(playerId, current);
        save();
        return new AddResult(previous, current);
    }

    public int resetLives(UUID playerId) {
        int resetValue = Math.min(plugin.getInitialLives(), plugin.getMaximumLives());
        lives.put(playerId, resetValue);
        save();
        return resetValue;
    }

    public void clampToMaximum(int maximum) {
        boolean changed = false;
        for (Map.Entry<UUID, Integer> entry : lives.entrySet()) {
            int clamped = Math.min(Math.max(entry.getValue(), 0), maximum);
            if (entry.getValue() != clamped) {
                entry.setValue(clamped);
                changed = true;
            }
        }
        if (changed) {
            save();
        }
    }

    public void save() {
        if (playersConfig == null) {
            playersConfig = new YamlConfiguration();
        }

        playersConfig.set(PLAYERS_SECTION, null);
        for (Map.Entry<UUID, Integer> entry : lives.entrySet()) {
            playersConfig.set(PLAYERS_SECTION + "." + entry.getKey(), entry.getValue());
        }

        try {
            playersConfig.save(playersFile);
        } catch (IOException exception) {
            plugin.getLogger().severe("No se pudo guardar players.yml: " + exception.getMessage());
        }
    }

    public record LifeChange(int previous, int current) {
        public boolean reachedZero() {
            return previous > 0 && current == 0;
        }
    }

    public record AddResult(int previous, int current) {
        public int added() {
            return current - previous;
        }
    }
}
