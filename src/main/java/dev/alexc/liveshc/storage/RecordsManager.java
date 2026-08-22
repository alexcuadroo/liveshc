package dev.alexc.liveshc.storage;

import dev.alexc.liveshc.Main;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;

public final class RecordsManager {
    private static final String EXECUTIONS_PATH = "comandos-sin-vidas-ejecutados";

    private final Main plugin;
    private final File recordsFile;
    private YamlConfiguration recordsConfig;
    private long noLivesCommandExecutions;

    public RecordsManager(Main plugin) {
        this.plugin = plugin;
        this.recordsFile = new File(plugin.getDataFolder(), "records.yml");
    }

    public void load() {
        recordsConfig = YamlConfiguration.loadConfiguration(recordsFile);
        noLivesCommandExecutions = Math.max(0L, recordsConfig.getLong(EXECUTIONS_PATH, 0L));
        if (!recordsFile.isFile()) {
            save();
        }
    }

    public long recordNoLivesCommandExecution() {
        noLivesCommandExecutions++;
        save();
        return noLivesCommandExecutions;
    }

    public long getNoLivesCommandExecutions() {
        return noLivesCommandExecutions;
    }

    public void save() {
        if (recordsConfig == null) {
            recordsConfig = new YamlConfiguration();
        }
        recordsConfig.set(EXECUTIONS_PATH, noLivesCommandExecutions);
        try {
            recordsConfig.save(recordsFile);
        } catch (IOException exception) {
            plugin.getLogger().severe("No se pudo guardar records.yml: " + exception.getMessage());
        }
    }
}
