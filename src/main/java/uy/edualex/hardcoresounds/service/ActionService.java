package uy.edualex.hardcoresounds.service;

import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import uy.edualex.hardcoresounds.config.PluginSettings;
import uy.edualex.hardcoresounds.model.CustomSound;

public final class ActionService {
    public enum TargetKind { SELF, OTHER, ALL }

    private final SoundService sounds;
    private final CooldownService cooldowns;
    private final Supplier<PluginSettings> settings;

    public ActionService(SoundService sounds, CooldownService cooldowns, Supplier<PluginSettings> settings) {
        this.sounds = sounds;
        this.cooldowns = cooldowns;
        this.settings = settings;
    }

    public boolean play(CommandSender sender, Collection<? extends Player> targets, CustomSound sound, TargetKind kind) {
        String permission = switch (kind) {
            case SELF -> "hardcoresounds.play";
            case OTHER -> "hardcoresounds.play.others";
            case ALL -> "hardcoresounds.play.all";
        };
        if (!sender.hasPermission(permission)) return deny(sender);
        if (targets.isEmpty()) {
            sender.sendMessage(Component.text("No hay jugadores destino.", NamedTextColor.RED));
            return false;
        }
        PluginSettings current = settings.get();
        long remaining = cooldowns.tryAcquire(senderId(sender), current.limitsEnabled(), current.senderCooldownMillis(), current.globalCooldownMillis());
        if (remaining > 0) {
            sender.sendMessage(Component.text("Espera " + remaining + " ms antes de reproducir otro sonido.", NamedTextColor.RED));
            return false;
        }
        sounds.play(targets, sound);
        if (current.notifySender()) sender.sendMessage(Component.text("Reproducido: " + sound.id(), NamedTextColor.GREEN));
        return true;
    }

    public boolean stop(CommandSender sender, Collection<? extends Player> targets, CustomSound sound) {
        if (!sender.hasPermission("hardcoresounds.stop")) return deny(sender);
        sounds.stop(targets, sound);
        sender.sendMessage(Component.text("Sonido detenido: " + sound.id(), NamedTextColor.GREEN));
        return true;
    }

    public boolean stopAll(CommandSender sender, Collection<? extends Player> targets) {
        if (!sender.hasPermission("hardcoresounds.stop")) return deny(sender);
        sounds.stopAll(targets);
        sender.sendMessage(Component.text("Sonidos detenidos.", NamedTextColor.GREEN));
        return true;
    }

    public static UUID senderId(CommandSender sender) {
        return sender instanceof Player player
                ? player.getUniqueId()
                : UUID.nameUUIDFromBytes(("console:" + sender.getName()).getBytes(StandardCharsets.UTF_8));
    }

    private static boolean deny(CommandSender sender) {
        sender.sendMessage(Component.text("No tienes permiso.", NamedTextColor.RED));
        return false;
    }
}
