package dev.alexc.liveshc.storage;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import java.util.function.IntSupplier;
import java.util.logging.Logger;

public final class LivesManager {
    private static final String PLAYERS_SECTION = "players";
    private static final String DEATHS_SECTION = "deaths";
    private static final String SHARED_LIVES_PATH = "shared-lives";

    private final File playersFile;
    private final Logger logger;
    private final IntSupplier initialLives;
    private final IntSupplier maximumLives;
    private final BooleanSupplier sharedLivesEnabled;
    private final Map<UUID, Integer> lives = new HashMap<>();
    private final Map<UUID, Integer> deaths = new HashMap<>();
    private Integer sharedLives;
    private YamlConfiguration playersConfig;

    public LivesManager(File playersFile, Logger logger, IntSupplier initialLives,
                        IntSupplier maximumLives, BooleanSupplier sharedLivesEnabled) {
        this.playersFile = playersFile;
        this.logger = logger;
        this.initialLives = initialLives;
        this.maximumLives = maximumLives;
        this.sharedLivesEnabled = sharedLivesEnabled;
    }

    public void load() {
        playersConfig = YamlConfiguration.loadConfiguration(playersFile);
        lives.clear();
        deaths.clear();
        sharedLives = playersConfig.contains(SHARED_LIVES_PATH)
                ? Math.max(0, playersConfig.getInt(SHARED_LIVES_PATH, 0))
                : null;

        ConfigurationSection players = playersConfig.getConfigurationSection(PLAYERS_SECTION);
        if (players != null) {
            for (String key : players.getKeys(false)) {
                try {
                    UUID playerId = UUID.fromString(key);
                    int storedLives = Math.max(0, players.getInt(key, 0));
                    lives.put(playerId, storedLives);
                } catch (IllegalArgumentException exception) {
                    logger.warning("Se ignoró un UUID inválido en players.yml: " + key);
                }
            }
        }

        ConfigurationSection storedDeaths = playersConfig.getConfigurationSection(DEATHS_SECTION);
        if (storedDeaths == null) {
            return;
        }
        for (String key : storedDeaths.getKeys(false)) {
            try {
                UUID playerId = UUID.fromString(key);
                deaths.put(playerId, Math.max(0, storedDeaths.getInt(key, 0)));
            } catch (IllegalArgumentException exception) {
                logger.warning("Se ignoró un UUID inválido en deaths de players.yml: " + key);
            }
        }
    }

    public int ensurePlayer(UUID playerId) {
        ensureDeaths(playerId);
        if (sharedLivesEnabled.getAsBoolean()) {
            return ensureSharedLives();
        }
        return ensureIndividualPlayer(playerId);
    }

    private int ensureDeaths(UUID playerId) {
        Integer current = deaths.get(playerId);
        if (current != null) {
            return current;
        }
        deaths.put(playerId, 0);
        save();
        return 0;
    }

    public void ensureCurrentModeInitialized() {
        if (sharedLivesEnabled.getAsBoolean()) {
            ensureSharedLives();
        }
    }

    private int ensureIndividualPlayer(UUID playerId) {
        Integer current = lives.get(playerId);
        if (current != null) {
            return current;
        }

        int initial = Math.min(initialLives.getAsInt(), maximumLives.getAsInt());
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
        return Math.min(initialLives.getAsInt(), maximumLives.getAsInt());
    }

    public int getLives(UUID playerId) {
        return getLives(playerId, sharedLivesEnabled.getAsBoolean());
    }

    public Map<UUID, Integer> getKnownIndividualLives() {
        return Map.copyOf(lives);
    }

    /**
     * UUID de todos los jugadores conocidos: los que tienen vidas individuales y los que solo
     * figuran por sus muertes (habitual en vidas compartidas o con cuentas Floodgate/Bedrock).
     */
    public Set<UUID> getKnownPlayers() {
        Set<UUID> known = new HashSet<>(lives.keySet());
        known.addAll(deaths.keySet());
        return Set.copyOf(known);
    }

    public Integer getStoredSharedLives() {
        return sharedLives;
    }

    public int getDeaths(UUID playerId) {
        return Math.max(0, deaths.getOrDefault(playerId, 0));
    }

    public int getLives(UUID playerId, boolean shared) {
        if (shared) {
            return Math.min(Math.max(ensureSharedLives(), 0), maximumLives.getAsInt());
        }
        Integer current = lives.get(playerId);
        if (current == null) {
            return Math.min(initialLives.getAsInt(), maximumLives.getAsInt());
        }
        return Math.min(Math.max(current, 0), maximumLives.getAsInt());
    }

    public LifeChange recordDeath(UUID playerId) {
        boolean shared = sharedLivesEnabled.getAsBoolean();
        int previous = shared ? ensureSharedLives() : ensureIndividualPlayer(playerId);
        int current = Math.max(0, previous - 1);
        setLives(playerId, current, shared);
        int deathCount = (int) Math.min(Integer.MAX_VALUE, (long) getDeaths(playerId) + 1L);
        deaths.put(playerId, deathCount);
        save();
        return new LifeChange(previous, current, shared);
    }

    public AddResult addLives(UUID playerId, int amount) {
        boolean shared = sharedLivesEnabled.getAsBoolean();
        int previous = shared ? ensureSharedLives() : ensureIndividualPlayer(playerId);
        int current = (int) Math.min(maximumLives.getAsInt(), (long) previous + amount);
        setLives(playerId, current, shared);
        save();
        return new AddResult(previous, current, shared);
    }

    public RemoveResult removeLives(UUID playerId, int amount) {
        boolean shared = sharedLivesEnabled.getAsBoolean();
        int previous = shared ? ensureSharedLives() : ensureIndividualPlayer(playerId);
        int current = (int) Math.max(0L, (long) previous - amount);
        setLives(playerId, current, shared);
        save();
        return new RemoveResult(previous, current, shared);
    }

    public int resetLives(UUID playerId) {
        return resetLives(playerId, sharedLivesEnabled.getAsBoolean());
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
        playersConfig.set(DEATHS_SECTION, null);
        for (Map.Entry<UUID, Integer> entry : deaths.entrySet()) {
            playersConfig.set(DEATHS_SECTION + "." + entry.getKey(), entry.getValue());
        }
        playersConfig.set(SHARED_LIVES_PATH, sharedLives);

        try {
            playersConfig.save(playersFile);
        } catch (IOException exception) {
            logger.severe("No se pudo guardar players.yml: " + exception.getMessage());
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

    public record RemoveResult(int previous, int current, boolean shared) {
        public int removed() {
            return previous - current;
        }

        public boolean reachedZero() {
            return previous > 0 && current == 0;
        }
    }
}
