package uy.edualex.hardcoresounds.model;

import java.util.List;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.sound.Sound;
import net.kyori.adventure.text.Component;
import org.bukkit.Material;

public record CustomSound(
        String id,
        Key key,
        Component displayName,
        Material material,
        float volume,
        float pitch,
        Sound.Source source,
        List<Component> description
) {
    public CustomSound {
        description = List.copyOf(description);
    }
}
