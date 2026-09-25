package dev.alexc.liveshc.display;

import dev.alexc.liveshc.Main;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.title.Title;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.event.entity.PlayerDeathEvent;

public final class DeathDuelDisplay {
    private final Main plugin;

    public DeathDuelDisplay(Main plugin) {
        this.plugin = plugin;
    }

    public void show(PlayerDeathEvent event) {
        if (!plugin.isDeathHudEnabled()) {
            return;
        }

        Player victim = event.getEntity();
        Entity causingEntity = event.getDamageSource().getCausingEntity();
        Player killer = causingEntity instanceof Player player
                && !player.getUniqueId().equals(victim.getUniqueId()) ? player : null;

        Component leftName = killer == null
                ? Component.text("ENTORNO", NamedTextColor.GRAY, TextDecoration.BOLD)
                : Component.text(killer.getName(), NamedTextColor.RED, TextDecoration.BOLD);
        Component titleLine = Component.empty()
                .append(leftName)
                .append(Component.text("  vs  ", NamedTextColor.DARK_GRAY))
                .append(Component.text(victim.getName(), NamedTextColor.GREEN, TextDecoration.BOLD));

        Component scores = killer == null
                ? Component.text("Muertes: " + plugin.getDeaths(victim.getUniqueId()), NamedTextColor.GRAY)
                : Component.text("Muertes: " + plugin.getDeaths(killer.getUniqueId()), NamedTextColor.RED)
                        .append(Component.text("  |  ", NamedTextColor.DARK_GRAY))
                        .append(Component.text("Muertes: " + plugin.getDeaths(victim.getUniqueId()), NamedTextColor.GREEN));

        Title death = Title.title(titleLine, scores,
                plugin.getDeathHudFadeInTicks(),
                plugin.getDeathHudStayTicks(),
                plugin.getDeathHudFadeOutTicks());
        victim.showTitle(death);
        if (killer != null) {
            killer.showTitle(death);
        }
    }
}
