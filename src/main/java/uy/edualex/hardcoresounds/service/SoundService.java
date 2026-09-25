package uy.edualex.hardcoresounds.service;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import net.kyori.adventure.sound.Sound;
import net.kyori.adventure.sound.SoundStop;
import org.bukkit.entity.Player;
import uy.edualex.hardcoresounds.model.CustomSound;

public final class SoundService {
    private final AtomicReference<Map<String, CustomSound>> catalog = new AtomicReference<>(Map.of());

    public void replaceCatalog(Map<String, CustomSound> sounds) {
        catalog.set(Map.copyOf(sounds));
    }

    public Optional<CustomSound> find(String id) {
        return Optional.ofNullable(catalog.get().get(id.toLowerCase(java.util.Locale.ROOT)));
    }

    public Collection<CustomSound> sounds() {
        return catalog.get().values();
    }

    public void play(Collection<? extends Player> players, CustomSound customSound) {
        Sound sound = Sound.sound(customSound.key(), customSound.source(), customSound.volume(), customSound.pitch());
        players.forEach(player -> player.playSound(sound));
    }

    public void stop(Collection<? extends Player> players, CustomSound customSound) {
        SoundStop stop = SoundStop.named(customSound.key());
        players.forEach(player -> player.stopSound(stop));
    }

    public void stopAll(Collection<? extends Player> players) {
        players.forEach(player -> player.stopSound(SoundStop.all()));
    }
}
