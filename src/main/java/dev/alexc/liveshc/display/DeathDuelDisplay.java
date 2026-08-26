package dev.alexc.liveshc.display;

import dev.alexc.liveshc.Main;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.object.ObjectContents;
import net.kyori.adventure.title.Title;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.event.entity.PlayerDeathEvent;

public final class DeathDuelDisplay {
    private static final Key DUEL_FONT = Key.key("liveshc", "duel");
    private static final char LIGHTNING_GLYPH = '\uE000';
    private static final String ENVIRONMENT_GLYPH = "☠";
    private static final String TITLE_GAP = "   ";
    private static final String SCORE_GAP = "              ";

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

        Component leftSide = killer == null
                ? Component.text(ENVIRONMENT_GLYPH, NamedTextColor.DARK_GRAY)
                : playerHead(killer);
        Component leftScore = killer == null
                ? Component.text("ENTORNO", NamedTextColor.GRAY, TextDecoration.BOLD)
                : score(plugin.getDeaths(killer.getUniqueId()));

        Component titleLine = Component.empty()
                .append(leftSide)
                .append(Component.text(TITLE_GAP))
                .append(Component.text(LIGHTNING_GLYPH).font(DUEL_FONT))
                .append(Component.text(TITLE_GAP))
                .append(playerHead(victim));

        Component scores = Component.empty()
                .append(leftScore)
                .append(Component.text(SCORE_GAP))
                .append(score(plugin.getDeaths(victim.getUniqueId())));

        Title death = Title.title(titleLine, scores,
                plugin.getDeathHudFadeInTicks(),
                plugin.getDeathHudStayTicks(),
                plugin.getDeathHudFadeOutTicks());
        victim.showTitle(death);
        if (killer == null) {
            return;
        }
        killer.showTitle(death);
    }

    private static Component playerHead(Player player) {
        return Component.object(ObjectContents.playerHead(player));
    }

    private static Component score(int lives) {
        return Component.text(lives, NamedTextColor.GREEN, TextDecoration.BOLD);
    }
}
