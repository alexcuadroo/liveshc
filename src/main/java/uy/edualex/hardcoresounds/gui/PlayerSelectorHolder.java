package uy.edualex.hardcoresounds.gui;

import org.bukkit.Bukkit;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import net.kyori.adventure.text.Component;

public final class PlayerSelectorHolder implements InventoryHolder {
    private final int page;
    private final String soundId;
    private final Inventory inventory;

    public PlayerSelectorHolder(int page, String soundId) {
        this.page = page;
        this.soundId = soundId;
        this.inventory = Bukkit.createInventory(this, 54, Component.text("Seleccionar jugador"));
    }

    public int page() { return page; }
    public String soundId() { return soundId; }

    @Override
    public Inventory getInventory() { return inventory; }
}
