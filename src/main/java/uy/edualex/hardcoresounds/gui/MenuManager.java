package uy.edualex.hardcoresounds.gui;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.inventory.meta.SkullMeta;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.java.JavaPlugin;
import uy.edualex.hardcoresounds.model.CustomSound;
import uy.edualex.hardcoresounds.service.ActionService;
import uy.edualex.hardcoresounds.service.CooldownService;
import uy.edualex.hardcoresounds.service.ResourcePackService;
import uy.edualex.hardcoresounds.service.SoundService;

public final class MenuManager implements Listener {
    private static final int PAGE_SIZE = 45;
    private final SoundService sounds;
    private final ActionService actions;
    private final CooldownService cooldowns;
    private final ResourcePackService packs;
    private final NamespacedKey soundKey;
    private final NamespacedKey playerKey;
    private final NamespacedKey actionKey;

    public MenuManager(JavaPlugin plugin, SoundService sounds, ActionService actions, CooldownService cooldowns, ResourcePackService packs) {
        this.sounds = sounds;
        this.actions = actions;
        this.cooldowns = cooldowns;
        this.packs = packs;
        this.soundKey = new NamespacedKey(plugin, "sound_id");
        this.playerKey = new NamespacedKey(plugin, "player_id");
        this.actionKey = new NamespacedKey(plugin, "menu_action");
    }

    public void openSounds(Player player, int requestedPage) {
        List<CustomSound> entries = sounds.sounds().stream().sorted(Comparator.comparing(CustomSound::id)).toList();
        int maxPage = Math.max(0, (entries.size() - 1) / PAGE_SIZE);
        int page = Math.max(0, Math.min(requestedPage, maxPage));
        SoundMenuHolder holder = new SoundMenuHolder(page);
        int start = page * PAGE_SIZE;
        for (int i = start; i < Math.min(entries.size(), start + PAGE_SIZE); i++) {
            CustomSound sound = entries.get(i);
            ItemStack item = new ItemStack(sound.material());
            ItemMeta meta = item.getItemMeta();
            meta.itemName(sound.displayName().decoration(TextDecoration.ITALIC, false));
            List<Component> lore = new ArrayList<>(sound.description());
            lore.add(Component.empty());
            lore.add(Component.text("Izquierdo: para ti", NamedTextColor.GRAY));
            lore.add(Component.text("Derecho: elegir jugador", NamedTextColor.GRAY));
            lore.add(Component.text("Shift+izquierdo: para todos", NamedTextColor.GRAY));
            meta.lore(lore.stream().map(line -> line.decoration(TextDecoration.ITALIC, false)).toList());
            meta.getPersistentDataContainer().set(soundKey, PersistentDataType.STRING, sound.id());
            item.setItemMeta(meta);
            holder.getInventory().setItem(i - start, item);
        }
        addNavigation(holder.getInventory(), page, maxPage);
        player.openInventory(holder.getInventory());
    }

    private void openPlayers(Player viewer, String soundId, int requestedPage) {
        List<? extends Player> players = Bukkit.getOnlinePlayers().stream().sorted(Comparator.comparing(Player::getName, String.CASE_INSENSITIVE_ORDER)).toList();
        int maxPage = Math.max(0, (players.size() - 1) / PAGE_SIZE);
        int page = Math.max(0, Math.min(requestedPage, maxPage));
        PlayerSelectorHolder holder = new PlayerSelectorHolder(page, soundId);
        int start = page * PAGE_SIZE;
        for (int i = start; i < Math.min(players.size(), start + PAGE_SIZE); i++) {
            Player target = players.get(i);
            ItemStack item = new ItemStack(Material.PLAYER_HEAD);
            SkullMeta meta = (SkullMeta) item.getItemMeta();
            meta.setOwningPlayer(target);
            meta.itemName(Component.text(target.getName(), NamedTextColor.YELLOW).decoration(TextDecoration.ITALIC, false));
            meta.lore(List.of(Component.text("Clic para reproducir", NamedTextColor.GRAY).decoration(TextDecoration.ITALIC, false)));
            meta.getPersistentDataContainer().set(playerKey, PersistentDataType.STRING, target.getUniqueId().toString());
            item.setItemMeta(meta);
            holder.getInventory().setItem(i - start, item);
        }
        addNavigation(holder.getInventory(), page, maxPage);
        viewer.openInventory(holder.getInventory());
    }

    private void addNavigation(org.bukkit.inventory.Inventory inventory, int page, int maxPage) {
        if (page > 0) inventory.setItem(45, navigation(Material.ARROW, "Anterior", "previous"));
        inventory.setItem(49, navigation(Material.BARRIER, "Cerrar", "close"));
        if (page < maxPage) inventory.setItem(53, navigation(Material.ARROW, "Siguiente", "next"));
    }

    private ItemStack navigation(Material material, String name, String action) {
        ItemStack item = new ItemStack(material);
        ItemMeta meta = item.getItemMeta();
        meta.itemName(Component.text(name).decoration(TextDecoration.ITALIC, false));
        meta.getPersistentDataContainer().set(actionKey, PersistentDataType.STRING, action);
        item.setItemMeta(meta);
        return item;
    }

    @EventHandler
    public void onClick(InventoryClickEvent event) {
        if (!(event.getInventory().getHolder(false) instanceof SoundMenuHolder) && !(event.getInventory().getHolder(false) instanceof PlayerSelectorHolder)) return;
        event.setCancelled(true);
        if (!(event.getWhoClicked() instanceof Player player) || event.getClickedInventory() != event.getInventory()) return;
        ItemStack item = event.getCurrentItem();
        if (item == null || item.getType().isAir()) return;
        ItemMeta meta = item.getItemMeta();
        String action = meta.getPersistentDataContainer().get(actionKey, PersistentDataType.STRING);
        if (action != null) {
            navigate(player, event.getInventory().getHolder(false), action);
            return;
        }
        if (event.getInventory().getHolder(false) instanceof SoundMenuHolder holder) {
            String soundId = meta.getPersistentDataContainer().get(soundKey, PersistentDataType.STRING);
            CustomSound sound = soundId == null ? null : sounds.find(soundId).orElse(null);
            if (sound == null) return;
            if (event.isRightClick()) {
                if (player.hasPermission("hardcoresounds.play.others")) openPlayers(player, sound.id(), 0);
                else player.sendMessage(Component.text("No tienes permiso.", NamedTextColor.RED));
            }
            else if (event.isShiftClick()) actions.play(player, Bukkit.getOnlinePlayers(), sound, ActionService.TargetKind.ALL);
            else actions.play(player, List.of(player), sound, ActionService.TargetKind.SELF);
        } else if (event.getInventory().getHolder(false) instanceof PlayerSelectorHolder holder) {
            String uuidText = meta.getPersistentDataContainer().get(playerKey, PersistentDataType.STRING);
            Player target;
            try { target = uuidText == null ? null : Bukkit.getPlayer(UUID.fromString(uuidText)); }
            catch (IllegalArgumentException ignored) { target = null; }
            CustomSound sound = sounds.find(holder.soundId()).orElse(null);
            if (target == null || sound == null) {
                player.sendMessage(Component.text("El jugador o sonido ya no está disponible.", NamedTextColor.RED));
                openSounds(player, 0);
                return;
            }
            if (actions.play(player, List.of(target), sound, target.equals(player) ? ActionService.TargetKind.SELF : ActionService.TargetKind.OTHER)) openSounds(player, 0);
        }
    }

    private void navigate(Player player, org.bukkit.inventory.InventoryHolder rawHolder, String action) {
        if ("close".equals(action)) { player.closeInventory(); return; }
        int delta = "next".equals(action) ? 1 : -1;
        if (rawHolder instanceof SoundMenuHolder holder) openSounds(player, holder.page() + delta);
        else if (rawHolder instanceof PlayerSelectorHolder holder) openPlayers(player, holder.soundId(), holder.page() + delta);
    }

    @EventHandler
    public void onDrag(InventoryDragEvent event) {
        if (event.getInventory().getHolder(false) instanceof SoundMenuHolder || event.getInventory().getHolder(false) instanceof PlayerSelectorHolder) event.setCancelled(true);
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        cooldowns.remove(event.getPlayer().getUniqueId());
        packs.remove(event.getPlayer().getUniqueId());
    }
}
