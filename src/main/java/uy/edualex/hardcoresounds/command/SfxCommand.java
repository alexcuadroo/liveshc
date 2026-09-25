package uy.edualex.hardcoresounds.command;

import com.mojang.brigadier.Command;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import io.papermc.paper.command.brigadier.CommandSourceStack;
import io.papermc.paper.command.brigadier.Commands;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.Bukkit;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import uy.edualex.hardcoresounds.gui.MenuManager;
import uy.edualex.hardcoresounds.model.CustomSound;
import uy.edualex.hardcoresounds.service.ActionService;
import uy.edualex.hardcoresounds.service.SoundService;

public final class SfxCommand {
    private final SoundService sounds;
    private final ActionService actions;
    private final MenuManager menus;
    private final BooleanSupplier guiEnabled;
    private final Consumer<CommandSender> reload;

    public SfxCommand(SoundService sounds, ActionService actions, MenuManager menus, BooleanSupplier guiEnabled, Consumer<CommandSender> reload) {
        this.sounds = sounds;
        this.actions = actions;
        this.menus = menus;
        this.guiEnabled = guiEnabled;
        this.reload = reload;
    }

    public LiteralArgumentBuilder<CommandSourceStack> build() {
        var soundArgument = Commands.argument("sound", StringArgumentType.word())
                .suggests((context, builder) -> {
                    sounds.sounds().stream().map(CustomSound::id).sorted().filter(id -> id.startsWith(builder.getRemainingLowerCase())).forEach(builder::suggest);
                    return builder.buildFuture();
                });

        return Commands.literal("sfx")
                .requires(source -> source.getSender().hasPermission("hardcoresounds.use"))
                .executes(context -> root(context.getSource().getSender()))
                .then(Commands.literal("list").executes(context -> list(context.getSource().getSender())))
                .then(Commands.literal("play").then(soundArgument
                        .executes(context -> play(context.getSource().getSender(), StringArgumentType.getString(context, "sound"), null))
                        .then(targetArgument().executes(context -> play(context.getSource().getSender(), StringArgumentType.getString(context, "sound"), StringArgumentType.getString(context, "target"))))))
                .then(Commands.literal("stop").then(Commands.argument("sound", StringArgumentType.word())
                        .suggests((context, builder) -> {
                            sounds.sounds().stream().map(CustomSound::id).sorted().filter(id -> id.startsWith(builder.getRemainingLowerCase())).forEach(builder::suggest);
                            return builder.buildFuture();
                        })
                        .executes(context -> stop(context.getSource().getSender(), StringArgumentType.getString(context, "sound"), null))
                        .then(targetArgument().executes(context -> stop(context.getSource().getSender(), StringArgumentType.getString(context, "sound"), StringArgumentType.getString(context, "target"))))))
                .then(Commands.literal("stopall")
                        .executes(context -> stopAll(context.getSource().getSender(), null))
                        .then(targetArgument().executes(context -> stopAll(context.getSource().getSender(), StringArgumentType.getString(context, "target")))))
                .then(Commands.literal("reload").executes(context -> {
                    if (!context.getSource().getSender().hasPermission("hardcoresounds.reload")) return denied(context.getSource().getSender());
                    reload.accept(context.getSource().getSender());
                    return Command.SINGLE_SUCCESS;
                }));
    }

    private com.mojang.brigadier.builder.RequiredArgumentBuilder<CommandSourceStack, String> targetArgument() {
        return Commands.argument("target", StringArgumentType.word()).suggests((context, builder) -> {
            builder.suggest("@a");
            Bukkit.getOnlinePlayers().stream().map(Player::getName).sorted(String.CASE_INSENSITIVE_ORDER)
                    .filter(name -> name.toLowerCase(Locale.ROOT).startsWith(builder.getRemainingLowerCase())).forEach(builder::suggest);
            return builder.buildFuture();
        });
    }

    private int root(CommandSender sender) {
        if (sender instanceof Player player && guiEnabled.getAsBoolean()) menus.openSounds(player, 0);
        else sender.sendMessage(Component.text("/sfx list | play | stop | stopall | reload", NamedTextColor.YELLOW));
        return Command.SINGLE_SUCCESS;
    }

    private int list(CommandSender sender) {
        String ids = sounds.sounds().stream().map(CustomSound::id).sorted().reduce((a, b) -> a + ", " + b).orElse("(ninguno)");
        sender.sendMessage(Component.text("Sonidos disponibles: " + ids, NamedTextColor.YELLOW));
        return Command.SINGLE_SUCCESS;
    }

    private int play(CommandSender sender, String id, String targetText) {
        CustomSound sound = requireSound(sender, id);
        if (sound == null) return 0;
        Target target = resolveTarget(sender, targetText);
        if (target == null) return 0;
        return actions.play(sender, target.players, sound, target.kind) ? Command.SINGLE_SUCCESS : 0;
    }

    private int stop(CommandSender sender, String id, String targetText) {
        CustomSound sound = requireSound(sender, id);
        if (sound == null) return 0;
        Target target = resolveTarget(sender, targetText);
        return target != null && actions.stop(sender, target.players, sound) ? Command.SINGLE_SUCCESS : 0;
    }

    private int stopAll(CommandSender sender, String targetText) {
        Target target = resolveTarget(sender, targetText);
        return target != null && actions.stopAll(sender, target.players) ? Command.SINGLE_SUCCESS : 0;
    }

    private CustomSound requireSound(CommandSender sender, String id) {
        CustomSound sound = sounds.find(id).orElse(null);
        if (sound == null) sender.sendMessage(Component.text("Sonido desconocido: " + id, NamedTextColor.RED));
        return sound;
    }

    private Target resolveTarget(CommandSender sender, String text) {
        if (text == null) {
            if (sender instanceof Player player) return new Target(List.of(player), ActionService.TargetKind.SELF);
            sender.sendMessage(Component.text("La consola debe indicar un jugador o @a.", NamedTextColor.RED));
            return null;
        }
        if ("@a".equalsIgnoreCase(text)) return new Target(Bukkit.getOnlinePlayers(), ActionService.TargetKind.ALL);
        Player target = Bukkit.getPlayerExact(text);
        if (target == null) {
            sender.sendMessage(Component.text("Jugador no encontrado: " + text, NamedTextColor.RED));
            return null;
        }
        ActionService.TargetKind kind = sender instanceof Player player && player.equals(target) ? ActionService.TargetKind.SELF : ActionService.TargetKind.OTHER;
        return new Target(List.of(target), kind);
    }

    private static int denied(CommandSender sender) {
        sender.sendMessage(Component.text("No tienes permiso.", NamedTextColor.RED));
        return 0;
    }

    private record Target(Collection<? extends Player> players, ActionService.TargetKind kind) {}
}
