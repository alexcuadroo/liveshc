package dev.alexc.liveshc;

import dev.alexc.liveshc.command.LivesHCCommand;
import dev.alexc.liveshc.listener.PlayerLivesListener;
import dev.alexc.liveshc.placeholder.LivesHCExpansion;
import dev.alexc.liveshc.storage.LivesManager;
import dev.alexc.liveshc.web.WebSnapshotService;
import org.bukkit.Bukkit;
import org.bukkit.command.PluginCommand;
import org.bukkit.configuration.InvalidConfigurationException;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.util.UUID;

public final class Main extends JavaPlugin {
    private int initialLives;
    private int maximumLives;
    private int noLivesCommandDelaySeconds;
    private boolean sharedLivesEnabled;
    private String noLivesCommand;
    private LivesManager livesManager;
    private WebSnapshotService webSnapshotService;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        loadSettings();

        livesManager = new LivesManager(this);
        livesManager.load();
        livesManager.clampToMaximum(maximumLives);
        livesManager.ensureCurrentModeInitialized();

        getServer().getPluginManager().registerEvents(new PlayerLivesListener(this), this);
        registerCommand();
        registerPlaceholderExpansion();
        webSnapshotService = new WebSnapshotService(this);
        webSnapshotService.start();
        getLogger().info("LivesHC habilitado correctamente.");
    }

    @Override
    public void onDisable() {
        if (webSnapshotService != null) {
            webSnapshotService.stop();
        }
        if (livesManager != null) {
            livesManager.save();
        }
    }

    private void registerCommand() {
        PluginCommand command = getCommand("liveshc");
        if (command == null) {
            getLogger().severe("No se pudo registrar /liveshc. Revisa plugin.yml.");
            getServer().getPluginManager().disablePlugin(this);
            return;
        }

        LivesHCCommand executor = new LivesHCCommand(this);
        command.setExecutor(executor);
        command.setTabCompleter(executor);
    }

    private void registerPlaceholderExpansion() {
        if (Bukkit.getPluginManager().isPluginEnabled("PlaceholderAPI")) {
            new LivesHCExpansion(this).register();
            getLogger().info("Expansión de PlaceholderAPI registrada.");
        } else {
            getLogger().info("PlaceholderAPI no está instalado; se omite la integración.");
        }
    }

    private void loadSettings() {
        int configuredMaximum = getConfig().getInt("vidas-maximas", 5);
        int configuredInitial = getConfig().getInt("vidas-iniciales", 3);
        int configuredDelay = getConfig().getInt("delay-comando-segundos", 0);

        if (configuredMaximum < 0) {
            getLogger().warning("vidas-maximas no puede ser negativa; se usará 0.");
            configuredMaximum = 0;
        }
        if (configuredInitial < 0) {
            getLogger().warning("vidas-iniciales no puede ser negativa; se usará 0.");
            configuredInitial = 0;
        }
        if (configuredInitial > configuredMaximum) {
            getLogger().warning("vidas-iniciales supera vidas-maximas; se limitará al máximo.");
            configuredInitial = configuredMaximum;
        }
        if (configuredDelay < 0) {
            getLogger().warning("delay-comando-segundos no puede ser negativo; se usará 0.");
            configuredDelay = 0;
        }

        maximumLives = configuredMaximum;
        initialLives = configuredInitial;
        noLivesCommandDelaySeconds = configuredDelay;
        sharedLivesEnabled = getConfig().getBoolean("vidas-compartidas", false);
        noLivesCommand = getConfig().getString("comando-sin-vidas", "");
        if (noLivesCommand == null) {
            noLivesCommand = "";
        }
    }

    public boolean reloadLivesConfig() {
        try {
            File configFile = new File(getDataFolder(), "config.yml");
            if (configFile.isFile()) {
                YamlConfiguration validation = new YamlConfiguration();
                validation.load(configFile);
            }
            reloadConfig();
            loadSettings();
            livesManager.clampToMaximum(maximumLives);
            livesManager.ensureCurrentModeInitialized();
            if (webSnapshotService != null) {
                webSnapshotService.reload();
            }
            return true;
        } catch (IOException | InvalidConfigurationException | RuntimeException exception) {
            getLogger().severe("No se pudo recargar config.yml: " + exception.getMessage());
            return false;
        }
    }

    public int getLives(UUID playerId) {
        return livesManager.getLives(playerId);
    }

    public int getInitialLives() {
        return initialLives;
    }

    public int getMaximumLives() {
        return maximumLives;
    }

    public boolean isSharedLivesEnabled() {
        return sharedLivesEnabled;
    }

    public String getNoLivesCommand() {
        return noLivesCommand;
    }

    public int getNoLivesCommandDelaySeconds() {
        return noLivesCommandDelaySeconds;
    }

    public LivesManager getLivesManager() {
        return livesManager;
    }

    public WebSnapshotService getWebSnapshotService() {
        return webSnapshotService;
    }
}
