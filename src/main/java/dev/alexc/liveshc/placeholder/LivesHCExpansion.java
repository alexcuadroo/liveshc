package dev.alexc.liveshc.placeholder;

import dev.alexc.liveshc.Main;
import me.clip.placeholderapi.expansion.PlaceholderExpansion;
import org.bukkit.OfflinePlayer;
import org.jetbrains.annotations.NotNull;

public final class LivesHCExpansion extends PlaceholderExpansion {
    private final Main plugin;

    public LivesHCExpansion(Main plugin) {
        this.plugin = plugin;
    }

    @Override
    public @NotNull String getIdentifier() {
        return "liveshc";
    }

    @Override
    public @NotNull String getAuthor() {
        return String.join(", ", plugin.getPluginMeta().getAuthors());
    }

    @Override
    public @NotNull String getVersion() {
        return plugin.getPluginMeta().getVersion();
    }

    @Override
    public boolean persist() {
        return true;
    }

    @Override
    public String onRequest(OfflinePlayer player, @NotNull String params) {
        if (params.equalsIgnoreCase("maxvidas")) {
            return Integer.toString(plugin.getMaximumLives());
        }
        if (params.equalsIgnoreCase("intentos")) {
            return Long.toString(plugin.getRecordsManager().getNoLivesCommandExecutions());
        }
        if (params.equalsIgnoreCase("vidas")) {
            if (player == null) {
                return null;
            }
            return Integer.toString(plugin.getLives(player.getUniqueId()));
        }
        return null;
    }
}
