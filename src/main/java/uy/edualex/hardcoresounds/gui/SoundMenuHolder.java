package uy.edualex.hardcoresounds.gui;

import org.bukkit.Bukkit;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import net.kyori.adventure.text.Component;

public final class SoundMenuHolder implements InventoryHolder {
    private final int page;
    private final Inventory inventory;

    public SoundMenuHolder(int page) {
        this.page = page;
        this.inventory = Bukkit.createInventory(this, 54, Component.text("Hardcore Sounds"));
    }

    public int page() { return page; }

    @Override
    public Inventory getInventory() { return inventory; }
}
