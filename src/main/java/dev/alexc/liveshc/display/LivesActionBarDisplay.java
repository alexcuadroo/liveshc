package dev.alexc.liveshc.display;

import dev.alexc.liveshc.Main;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

/**
 * Muestra periódicamente en el action bar las muertes y vidas del jugador.
 * Se reconstruyó a partir del JAR 1.3.2 desplegado, que ya contaba con esta
 * funcionalidad aunque el código fuente la había perdido.
 */
public final class LivesActionBarDisplay {
    private static final long PERIOD_TICKS = 40L;

    private final Main plugin;

    public LivesActionBarDisplay(Main plugin) {
        this.plugin = plugin;
    }

    public void start() {
        Bukkit.getScheduler().runTaskTimer(plugin, this::updateAll, 0L, PERIOD_TICKS);
    }

    private void updateAll() {
        if (!plugin.isLivesActionBarEnabled()) {
            return;
        }
        for (Player player : Bukkit.getOnlinePlayers()) {
            Component message = Component.text("Muertes: ", NamedTextColor.GRAY)
                    .append(Component.text(plugin.getDeaths(player.getUniqueId()), NamedTextColor.RED))
                    .append(Component.text("  |  Vidas: ", NamedTextColor.GRAY))
                    .append(Component.text(plugin.getLives(player.getUniqueId()), NamedTextColor.YELLOW));
            player.sendActionBar(message);
        }
    }
}
