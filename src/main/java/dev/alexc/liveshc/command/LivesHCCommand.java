package dev.alexc.liveshc.command;

import dev.alexc.liveshc.Main;
import dev.alexc.liveshc.storage.LivesManager.AddResult;
import dev.alexc.liveshc.storage.LivesManager.RemoveResult;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public final class LivesHCCommand implements CommandExecutor, TabCompleter {
    private static final String RELOAD_PERMISSION = "liveshc.reload";
    private static final String ADD_PERMISSION = "liveshc.add";
    private static final String REMOVE_PERMISSION = "liveshc.remove";
    private static final String GET_PERMISSION = "liveshc.get";
    private static final String USAGE = "Uso: /liveshc reload | /liveshc add|remove <jugador> <cantidad> | "
            + "/liveshc get <jugador>";

    private final Main plugin;

    public LivesHCCommand(Main plugin) {
        this.plugin = plugin;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command,
                             @NotNull String label, @NotNull String[] args) {
        if (args.length == 1 && args[0].equalsIgnoreCase("reload")) {
            return reload(sender);
        }
        if (args.length == 3 && args[0].equalsIgnoreCase("add")) {
            return addLives(sender, args[1], args[2]);
        }
        if (args.length == 3 && isRemove(args[0])) {
            return removeLives(sender, args[1], args[2]);
        }
        if (args.length == 2 && isGet(args[0])) {
            return showLives(sender, args[1]);
        }

        sender.sendMessage(USAGE);
        return true;
    }

    private boolean reload(CommandSender sender) {
        if (!sender.hasPermission(RELOAD_PERMISSION)) {
            sender.sendMessage("No tienes permiso para ejecutar este comando.");
            return true;
        }

        if (plugin.reloadLivesConfig()) {
            sender.sendMessage("Configuración y records.yml de LivesHC recargados correctamente.");
        } else {
            sender.sendMessage("No se pudo recargar la configuración. Revisa la consola.");
        }
        return true;
    }

    private boolean addLives(CommandSender sender, String playerName, String amountArgument) {
        if (!sender.hasPermission(ADD_PERMISSION)) {
            sender.sendMessage("No tienes permiso para ejecutar este comando.");
            return true;
        }

        Player target = Bukkit.getPlayerExact(playerName);
        if (target == null) {
            sender.sendMessage("El jugador debe estar conectado.");
            return true;
        }

        Integer amount = parseAmount(sender, amountArgument);
        if (amount == null) {
            return true;
        }

        AddResult result = plugin.getLivesManager().addLives(target.getUniqueId(), amount);
        plugin.getWebSnapshotService().publishPlayer(target, true);
        if (result.shared()) {
            sender.sendMessage("Se añadieron " + result.added() + " vidas al contador compartido"
                    + ". Ahora tiene " + result.current() + "/" + plugin.getMaximumLives() + ".");
        } else {
            sender.sendMessage("Se añadieron " + result.added() + " vidas a " + target.getName()
                    + ". Ahora tiene " + result.current() + "/" + plugin.getMaximumLives() + ".");
        }
        return true;
    }

    private boolean removeLives(CommandSender sender, String playerName, String amountArgument) {
        if (!sender.hasPermission(REMOVE_PERMISSION)) {
            sender.sendMessage("No tienes permiso para ejecutar este comando.");
            return true;
        }

        Player target = Bukkit.getPlayerExact(playerName);
        if (target == null) {
            sender.sendMessage("El jugador debe estar conectado.");
            return true;
        }

        Integer amount = parseAmount(sender, amountArgument);
        if (amount == null) {
            return true;
        }

        RemoveResult result = plugin.getLivesManager().removeLives(target.getUniqueId(), amount);
        plugin.getWebSnapshotService().publishPlayer(target, true);
        if (result.shared()) {
            sender.sendMessage("Se quitaron " + result.removed() + " vidas al contador compartido"
                    + ". Ahora tiene " + result.current() + "/" + plugin.getMaximumLives() + ".");
        } else {
            sender.sendMessage("Se quitaron " + result.removed() + " vidas a " + target.getName()
                    + ". Ahora tiene " + result.current() + "/" + plugin.getMaximumLives() + ".");
        }
        if (result.reachedZero()) {
            plugin.handleLivesDepleted(target.getUniqueId(), target.getName(), result.shared());
            if (!plugin.getNoLivesCommand().isBlank()) {
                sender.sendMessage("Sin vidas: se ejecutó la acción configurada.");
            }
        }
        return true;
    }

    private boolean showLives(CommandSender sender, String playerName) {
        if (!sender.hasPermission(GET_PERMISSION)) {
            sender.sendMessage("No tienes permiso para ejecutar este comando.");
            return true;
        }

        Player online = Bukkit.getPlayerExact(playerName);
        UUID playerId = online != null ? online.getUniqueId() : findKnownPlayerId(playerName);
        if (playerId == null) {
            sender.sendMessage("No se encontró a ningún jugador con ese nombre.");
            return true;
        }

        String displayName = online != null ? online.getName() : resolveName(playerId);
        int current = plugin.getLives(playerId);
        if (plugin.isSharedLivesEnabled()) {
            sender.sendMessage("Contador compartido: " + current + "/" + plugin.getMaximumLives() + " vidas.");
        } else {
            sender.sendMessage(displayName + " tiene " + current + "/" + plugin.getMaximumLives() + " vidas.");
        }
        return true;
    }

    private Integer parseAmount(CommandSender sender, String argument) {
        int amount;
        try {
            amount = Integer.parseInt(argument);
        } catch (NumberFormatException exception) {
            sender.sendMessage("La cantidad debe ser un número entero positivo.");
            return null;
        }
        if (amount <= 0) {
            sender.sendMessage("La cantidad debe ser mayor que 0.");
            return null;
        }
        return amount;
    }

    private UUID findKnownPlayerId(String playerName) {
        for (UUID playerId : plugin.getLivesManager().getKnownIndividualLives().keySet()) {
            OfflinePlayer offline = Bukkit.getOfflinePlayer(playerId);
            if (playerName.equalsIgnoreCase(offline.getName())) {
                return playerId;
            }
        }
        return null;
    }

    private String resolveName(UUID playerId) {
        String name = Bukkit.getOfflinePlayer(playerId).getName();
        return name != null ? name : playerId.toString();
    }

    private static boolean isRemove(String argument) {
        return argument.equalsIgnoreCase("remove") || argument.equalsIgnoreCase("quitar");
    }

    private static boolean isGet(String argument) {
        return argument.equalsIgnoreCase("get") || argument.equalsIgnoreCase("vidas")
                || argument.equalsIgnoreCase("check");
    }

    @Override
    public List<String> onTabComplete(@NotNull CommandSender sender, @NotNull Command command,
                                      @NotNull String alias, @NotNull String[] args) {
        if (args.length == 1) {
            String input = args[0].toLowerCase(Locale.ROOT);
            List<String> suggestions = new ArrayList<>();
            if (sender.hasPermission(RELOAD_PERMISSION) && "reload".startsWith(input)) {
                suggestions.add("reload");
            }
            if (sender.hasPermission(ADD_PERMISSION) && "add".startsWith(input)) {
                suggestions.add("add");
            }
            if (sender.hasPermission(REMOVE_PERMISSION) && "remove".startsWith(input)) {
                suggestions.add("remove");
            }
            if (sender.hasPermission(GET_PERMISSION) && "get".startsWith(input)) {
                suggestions.add("get");
            }
            return suggestions;
        }
        if (args.length == 2 && hasPlayerPermission(sender, args[0])) {
            String input = args[1].toLowerCase(Locale.ROOT);
            return Bukkit.getOnlinePlayers().stream()
                    .map(Player::getName)
                    .filter(name -> name.toLowerCase(Locale.ROOT).startsWith(input))
                    .sorted(String.CASE_INSENSITIVE_ORDER)
                    .toList();
        }
        return Collections.emptyList();
    }

    private boolean hasPlayerPermission(CommandSender sender, String subcommand) {
        if (subcommand.equalsIgnoreCase("add")) return sender.hasPermission(ADD_PERMISSION);
        if (isRemove(subcommand)) return sender.hasPermission(REMOVE_PERMISSION);
        if (isGet(subcommand)) return sender.hasPermission(GET_PERMISSION);
        return false;
    }
}
