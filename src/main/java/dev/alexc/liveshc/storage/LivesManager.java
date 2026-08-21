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
    private static final String SHARED_LIVES_PATH = "shared-lives";

    private final Main plugin;
    private final File playersFile;
    private final Map<UUID, Integer> lives = new HashMap<>();
    private Integer sharedLives;
    private YamlConfiguration playersConfig;

    public LivesManager(Main plugin) {
        this.plugin = plugin;
        this.playersFile = new File(plugin.getDataFolder(), "players.yml");
    }

    public void load() {
        playersConfig = YamlConfiguration.loadConfiguration(playersFile);
        lives.clear();
        sharedLives = playersConfig.contains(SHARED_LIVES_PATH)
                ? Math.max(0, playersConfig.getInt(SHARED_LIVES_PATH, 0))
                : null;

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
        if (plugin.isSharedLivesEnabled()) {
            return ensureSharedLives();
        }
        return ensureIndividualPlayer(playerId);
    }

    public void ensureCurrentModeInitialized() {
        if (plugin.isSharedLivesEnabled()) {
            ensureSharedLives();
        }
    }

    private int ensureIndividualPlayer(UUID playerId) {
        Integer current = lives.get(playerId);
        if (current != null) {
            return current;
        }

        int initial = Math.min(plugin.getInitialLives(), plugin.getMaximumLives());
        lives.put(playerId, initial);
        save();
        return initial;
    }

    private int ensureSharedLives() {
        if (sharedLives != null) {
            return sharedLives;
        }

        sharedLives = initialValue();
        save();
        return sharedLives;
    }

    private int initialValue() {
        return Math.min(plugin.getInitialLives(), plugin.getMaximumLives());
    }

    public int getLives(UUID playerId) {
        return getLives(playerId, plugin.isSharedLivesEnabled());
    }

    public Map<UUID, Integer> getKnownIndividualLives() {
        return Map.copyOf(lives);
    }

    public Integer getStoredSharedLives() {
        return sharedLives;
    }

    public int getLives(UUID playerId, boolean shared) {
        if (shared) {
            return Math.min(Math.max(ensureSharedLives(), 0), plugin.getMaximumLives());
        }
        Integer current = lives.get(playerId);
        if (current == null) {
            return Math.min(plugin.getInitialLives(), plugin.getMaximumLives());
        }
        return Math.min(Math.max(current, 0), plugin.getMaximumLives());
    }

    public LifeChange removeLife(UUID playerId) {
        boolean shared = plugin.isSharedLivesEnabled();
        int previous = shared ? ensureSharedLives() : ensureIndividualPlayer(playerId);
        int current = Math.max(0, previous - 1);
        setLives(playerId, current, shared);
        save();
        return new LifeChange(previous, current, shared);
    }

    public AddResult addLives(UUID playerId, int amount) {
        boolean shared = plugin.isSharedLivesEnabled();
        int previous = shared ? ensureSharedLives() : ensureIndividualPlayer(playerId);
        int current = (int) Math.min(plugin.getMaximumLives(), (long) previous + amount);
        setLives(playerId, current, shared);
        save();
        return new AddResult(previous, current, shared);
    }

    public int resetLives(UUID playerId) {
        return resetLives(playerId, plugin.isSharedLivesEnabled());
    }

    public int resetLives(UUID playerId, boolean shared) {
        int resetValue = initialValue();
        setLives(playerId, resetValue, shared);
        save();
        return resetValue;
    }

    private void setLives(UUID playerId, int value, boolean shared) {
        if (shared) {
            sharedLives = value;
        } else {
            lives.put(playerId, value);
        }
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
        if (sharedLives != null) {
            int clampedShared = Math.min(Math.max(sharedLives, 0), maximum);
            if (sharedLives != clampedShared) {
                sharedLives = clampedShared;
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
        playersConfig.set(SHARED_LIVES_PATH, sharedLives);

        try {
            playersConfig.save(playersFile);
        } catch (IOException exception) {
            plugin.getLogger().severe("No se pudo guardar players.yml: " + exception.getMessage());
        }
    }

    public record LifeChange(int previous, int current, boolean shared) {
        public boolean reachedZero() {
            return previous > 0 && current == 0;
        }
    }

    public record AddResult(int previous, int current, boolean shared) {
        public int added() {
            return current - previous;
        }
    }
}
