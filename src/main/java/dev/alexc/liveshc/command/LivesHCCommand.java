package dev.alexc.liveshc.command;

import dev.alexc.liveshc.Main;
import dev.alexc.liveshc.storage.LivesManager.AddResult;
import org.bukkit.Bukkit;
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

public final class LivesHCCommand implements CommandExecutor, TabCompleter {
    private static final String RELOAD_PERMISSION = "liveshc.reload";
    private static final String ADD_PERMISSION = "liveshc.add";
    private static final String USAGE = "Uso: /liveshc reload o /liveshc add <jugador> <cantidad>";

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

        int amount;
        try {
            amount = Integer.parseInt(amountArgument);
        } catch (NumberFormatException exception) {
            sender.sendMessage("La cantidad debe ser un número entero positivo.");
            return true;
        }
        if (amount <= 0) {
            sender.sendMessage("La cantidad debe ser mayor que 0.");
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
            return suggestions;
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("add") && sender.hasPermission(ADD_PERMISSION)) {
            String input = args[1].toLowerCase(Locale.ROOT);
            return Bukkit.getOnlinePlayers().stream()
                    .map(Player::getName)
                    .filter(name -> name.toLowerCase(Locale.ROOT).startsWith(input))
                    .sorted(String.CASE_INSENSITIVE_ORDER)
                    .toList();
        }
        return Collections.emptyList();
    }
}
