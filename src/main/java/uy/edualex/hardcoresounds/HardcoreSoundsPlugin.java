package uy.edualex.hardcoresounds;

import io.papermc.paper.plugin.lifecycle.event.types.LifecycleEvents;
import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.configuration.InvalidConfigurationException;
import org.bukkit.plugin.java.JavaPlugin;
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

public final class HardcoreSoundsPlugin extends JavaPlugin {
    private final AtomicReference<PluginSettings> settings = new AtomicReference<>();
    private ConfigurationLoader configurationLoader;
    private SoundService soundService;
    private CooldownService cooldownService;
    private ResourcePackService resourcePackService;

    @Override
    public void onEnable() {
        saveBundledFiles();
        configurationLoader = new ConfigurationLoader(this);
        LoadedConfiguration initial;
        try {
            initial = configurationLoader.load();
        } catch (Exception exception) {
            getLogger().severe("Cannot load initial configuration: " + exception.getMessage());
            Bukkit.getPluginManager().disablePlugin(this);
            return;
        }
        settings.set(initial.settings());
        soundService = new SoundService();
        soundService.replaceCatalog(initial.sounds());
        cooldownService = new CooldownService();
        resourcePackService = new ResourcePackService(getLogger(), initial.settings());
        ActionService actions = new ActionService(soundService, cooldownService, settings::get);
        MenuManager menus = new MenuManager(this, soundService, actions, cooldownService, resourcePackService);
        Bukkit.getPluginManager().registerEvents(menus, this);
        Bukkit.getPluginManager().registerEvents(new ConnectionListener(resourcePackService), this);

        SfxCommand command = new SfxCommand(soundService, actions, menus, () -> settings.get().guiEnabled(), this::reloadPlugin);
        getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS, event ->
                event.registrar().register(command.build().build(), "Controla sonidos personalizados", List.of("hardcoresounds")));
        getLogger().info("Loaded " + initial.sounds().size() + " custom sounds.");
    }

    public void reloadPlugin(org.bukkit.command.CommandSender sender) {
        try {
            LoadedConfiguration candidate = configurationLoader.load();
            settings.set(candidate.settings());
            soundService.replaceCatalog(candidate.sounds());
            resourcePackService.replaceSettings(candidate.settings());
            cooldownService.clear();
            sender.sendMessage(Component.text("HardcoreSounds recargado: " + candidate.sounds().size() + " sonidos.", NamedTextColor.GREEN));
        } catch (IOException | InvalidConfigurationException | IllegalArgumentException exception) {
            sender.sendMessage(Component.text("La recarga falló; se conservó la configuración anterior: " + exception.getMessage(), NamedTextColor.RED));
            getLogger().warning("Reload failed; previous configuration preserved: " + exception.getMessage());
        }
    }

    private void saveBundledFiles() {
        if (!getDataFolder().exists() && !getDataFolder().mkdirs()) throw new IllegalStateException("Cannot create plugin data folder");
        if (!new File(getDataFolder(), "config.yml").exists()) saveResource("config.yml", false);
        if (!new File(getDataFolder(), "sounds.yml").exists()) saveResource("sounds.yml", false);
    }
}
