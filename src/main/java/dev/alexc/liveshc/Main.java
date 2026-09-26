package dev.alexc.liveshc;

import dev.alexc.liveshc.command.LivesHCCommand;
import dev.alexc.liveshc.display.DeathDuelDisplay;
import dev.alexc.liveshc.listener.PlayerLivesListener;
import dev.alexc.liveshc.placeholder.LivesHCExpansion;
import dev.alexc.liveshc.storage.LivesManager;
import dev.alexc.liveshc.storage.RecordsManager;
import dev.alexc.liveshc.web.WebSnapshotService;
import uy.edualex.hardcoresounds.command.SfxCommand;
import uy.edualex.hardcoresounds.config.ConfigurationLoader;
import uy.edualex.hardcoresounds.config.LoadedConfiguration;
import uy.edualex.hardcoresounds.config.PluginSettings;
import uy.edualex.hardcoresounds.gui.MenuManager;
import uy.edualex.hardcoresounds.listener.ConnectionListener;
import uy.edualex.hardcoresounds.service.ActionService;
import uy.edualex.hardcoresounds.service.CooldownService;
import uy.edualex.hardcoresounds.service.ResourcePackService;
import uy.edualex.hardcoresounds.service.SoundService;
import io.papermc.paper.plugin.lifecycle.event.types.LifecycleEvents;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.command.PluginCommand;
import org.bukkit.configuration.InvalidConfigurationException;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.util.Locale;
import java.util.UUID;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

public final class Main extends JavaPlugin {
    private int initialLives;
    private int maximumLives;
    private int noLivesCommandDelaySeconds;
    private boolean sharedLivesEnabled;
    private String displayMode;
    private boolean deathHudEnabled;
    private int deathHudFadeInTicks;
    private int deathHudStayTicks;
    private int deathHudFadeOutTicks;
    private String noLivesCommand;
    private LivesManager livesManager;
    private RecordsManager recordsManager;
    private WebSnapshotService webSnapshotService;
    private DeathDuelDisplay deathDuelDisplay;
    private ConfigurationLoader soundConfigurationLoader;
    private final AtomicReference<PluginSettings> soundSettings = new AtomicReference<>();
    private SoundService soundService;
    private CooldownService cooldownService;
    private ResourcePackService resourcePackService;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        if (!new File(getDataFolder(), "sounds.yml").exists()) saveResource("sounds.yml", false);
        loadSettings();

        livesManager = new LivesManager(this);
        livesManager.load();
        livesManager.clampToMaximum(maximumLives);
        livesManager.ensureCurrentModeInitialized();
        recordsManager = new RecordsManager(this);
        recordsManager.load();
        deathDuelDisplay = new DeathDuelDisplay(this);
        if (!enableSounds()) {
            getServer().getPluginManager().disablePlugin(this);
            return;
        }

        getServer().getPluginManager().registerEvents(new PlayerLivesListener(this), this);
        if (!registerCommand()) {
            return;
        }
        registerPlaceholderExpansion();
        webSnapshotService = new WebSnapshotService(this);
        webSnapshotService.start();
        new UpdateChecker(this).checkForUpdates();
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
        if (recordsManager != null) {
            recordsManager.save();
        }
    }

    private boolean enableSounds() {
        soundConfigurationLoader = new ConfigurationLoader(this);
        try {
            LoadedConfiguration loaded = soundConfigurationLoader.load();
            soundSettings.set(loaded.settings());
            soundService = new SoundService();
            soundService.replaceCatalog(loaded.sounds());
            cooldownService = new CooldownService();
            resourcePackService = new ResourcePackService(getLogger(), loaded.settings());
            ActionService actions = new ActionService(soundService, cooldownService, soundSettings::get);
            MenuManager menus = new MenuManager(this, soundService, actions, cooldownService, resourcePackService);
            getServer().getPluginManager().registerEvents(menus, this);
            getServer().getPluginManager().registerEvents(new ConnectionListener(resourcePackService), this);
            SfxCommand command = new SfxCommand(soundService, actions, menus,
                    () -> soundSettings.get().guiEnabled(), this::reloadSounds);
            getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS, event ->
                    event.registrar().register(command.build().build(), "Controla sonidos personalizados", List.of("hardcoresounds")));
            getLogger().info("Sistema de sonidos integrado: " + loaded.sounds().size() + " sonidos.");
            return true;
        } catch (Exception exception) {
            getLogger().severe("No se pudo cargar la configuración de sonidos: " + exception.getMessage());
            return false;
        }
    }

    public void reloadSounds(org.bukkit.command.CommandSender sender) {
        try {
            LoadedConfiguration candidate = reloadSoundSettings();
            sender.sendMessage(Component.text("Sonidos recargados: " + candidate.sounds().size() + ".", NamedTextColor.GREEN));
        } catch (IOException | InvalidConfigurationException | IllegalArgumentException exception) {
            sender.sendMessage(Component.text("La recarga falló; se conservó la configuración anterior: " + exception.getMessage(), NamedTextColor.RED));
            getLogger().warning("Sound reload failed; previous configuration preserved: " + exception.getMessage());
        }
    }

    private LoadedConfiguration reloadSoundSettings() throws IOException, InvalidConfigurationException {
        LoadedConfiguration candidate = soundConfigurationLoader.load();
        soundSettings.set(candidate.settings());
        soundService.replaceCatalog(candidate.sounds());
        resourcePackService.replaceSettings(candidate.settings());
        cooldownService.clear();
        return candidate;
    }

    private boolean registerCommand() {
        PluginCommand command = getCommand("liveshc");
        if (command == null) {
            getLogger().severe("No se pudo registrar /liveshc. Revisa plugin.yml.");
            getServer().getPluginManager().disablePlugin(this);
            return false;
        }

        LivesHCCommand executor = new LivesHCCommand(this);
        command.setExecutor(executor);
        command.setTabCompleter(executor);
        return true;
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
        displayMode = parseDisplayMode(getConfig().getString("modo", "coop"));
        noLivesCommand = getConfig().getString("comando-sin-vidas", "");
        if (noLivesCommand == null) {
            noLivesCommand = "";
        }
        deathHudEnabled = getConfig().getBoolean("hud-muerte.habilitado", true);
        deathHudFadeInTicks = nonNegativeTicks("hud-muerte.fade-in-ticks", 5);
        deathHudStayTicks = nonNegativeTicks("hud-muerte.duracion-ticks", 160);
        deathHudFadeOutTicks = nonNegativeTicks("hud-muerte.fade-out-ticks", 10);
    }

    private int nonNegativeTicks(String path, int fallback) {
        int value = getConfig().getInt(path, fallback);
        if (value < 0) {
            getLogger().warning(path + " no puede ser negativo; se usará " + fallback + ".");
            return fallback;
        }
        return value;
    }

    private String parseDisplayMode(String raw) {
        String normalized = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        if (normalized.equals("solo") || normalized.equals("coop")) {
            return normalized;
        }
        getLogger().warning("modo desconocido '" + raw + "'; se usará 'coop'. Valores válidos: solo, coop.");
        return "coop";
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
            recordsManager.load();
            if (webSnapshotService != null) {
                webSnapshotService.reload();
            }
            reloadSoundSettings();
            return true;
        } catch (IOException | InvalidConfigurationException | RuntimeException exception) {
            getLogger().severe("No se pudo recargar config.yml: " + exception.getMessage());
            return false;
        }
    }

    /** Ejecuta la acción configurada cuando un jugador (o el contador compartido) se queda sin vidas. */
    public void handleLivesDepleted(UUID playerId, String playerName, boolean shared) {
        String command = noLivesCommand == null ? "" : noLivesCommand.trim();
        if (command.startsWith("/")) {
            command = command.substring(1).trim();
        }
        if (command.isEmpty()) {
            getLogger().severe("comando-sin-vidas está vacío; no se ejecutó ninguna acción para "
                    + playerName + ".");
            return;
        }

        String parsedCommand = command.replace("%player%", playerName);
        long delayTicks = noLivesCommandDelaySeconds * 20L;
        if (delayTicks == 0L) {
            executeNoLivesCommand(playerId, parsedCommand, shared);
            return;
        }

        Bukkit.getScheduler().runTaskLater(this, () -> {
            if (livesManager.getLives(playerId, shared) == 0) {
                executeNoLivesCommand(playerId, parsedCommand, shared);
            }
        }, delayTicks);
    }

    private void executeNoLivesCommand(UUID playerId, String parsedCommand, boolean shared) {
        boolean dispatched = Bukkit.dispatchCommand(Bukkit.getConsoleSender(), parsedCommand);
        if (dispatched) {
            recordsManager.recordNoLivesCommandExecution();
            livesManager.resetLives(playerId, shared);
            webSnapshotService.publishAll(false);
        } else {
            getLogger().warning("El comando sin vidas no fue reconocido: " + parsedCommand);
        }
    }

    public int getLives(UUID playerId) {
        return livesManager.getLives(playerId);
    }

    public int getDeaths(UUID playerId) {
        return livesManager.getDeaths(playerId);
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

    public String getDisplayMode() {
        return displayMode;
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

    public RecordsManager getRecordsManager() {
        return recordsManager;
    }

    public WebSnapshotService getWebSnapshotService() {
        return webSnapshotService;
    }

    public DeathDuelDisplay getDeathDuelDisplay() {
        return deathDuelDisplay;
    }

    public boolean isDeathHudEnabled() {
        return deathHudEnabled;
    }

    public int getDeathHudFadeInTicks() {
        return deathHudFadeInTicks;
    }

    public int getDeathHudStayTicks() {
        return deathHudStayTicks;
    }

    public int getDeathHudFadeOutTicks() {
        return deathHudFadeOutTicks;
    }
}
