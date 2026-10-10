package dev.alexc.liveshc.storage;

import dev.alexc.liveshc.storage.LivesManager.AddResult;
import dev.alexc.liveshc.storage.LivesManager.LifeChange;
import dev.alexc.liveshc.storage.LivesManager.RemoveResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.nio.file.Path;
import java.util.UUID;
import java.util.logging.Logger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LivesManagerTest {
    private static final Logger LOGGER = Logger.getLogger("LivesManagerTest");

    private static LivesManager individual(File file, int initial, int maximum) {
        return new LivesManager(file, LOGGER, () -> initial, () -> maximum, () -> false);
    }

    private static LivesManager shared(File file, int initial, int maximum) {
        return new LivesManager(file, LOGGER, () -> initial, () -> maximum, () -> true);
    }

    @Test
    void deathOnlyTriggersReachedZeroWhenDroppingToZero(@TempDir Path dir) {
        UUID player = UUID.randomUUID();
        LivesManager manager = individual(dir.resolve("players.yml").toFile(), 3, 5);
        manager.ensurePlayer(player);

        LifeChange first = manager.recordDeath(player);
        assertEquals(3, first.previous());
        assertEquals(2, first.current());
        assertFalse(first.reachedZero(), "3 -> 2 no debe disparar el comando");

        LifeChange second = manager.recordDeath(player);
        assertEquals(1, second.current());
        assertFalse(second.reachedZero(), "2 -> 1 no debe disparar el comando");

        LifeChange third = manager.recordDeath(player);
        assertEquals(0, third.current());
        assertTrue(third.reachedZero(), "1 -> 0 sí debe disparar el comando");

        LifeChange fourth = manager.recordDeath(player);
        assertEquals(0, fourth.previous());
        assertEquals(0, fourth.current());
        assertFalse(fourth.reachedZero(), "estando ya en 0 no debe volver a disparar por sí solo");
        assertEquals(4, manager.getDeaths(player));
    }

    @Test
    void resetReturnsToInitialLives(@TempDir Path dir) {
        UUID player = UUID.randomUUID();
        LivesManager manager = individual(dir.resolve("players.yml").toFile(), 3, 5);
        manager.recordDeath(player);
        manager.recordDeath(player);
        manager.recordDeath(player);
        assertEquals(0, manager.getLives(player));

        manager.resetLives(player);
        assertEquals(3, manager.getLives(player));
    }

    @Test
    void addLivesCapsAtMaximum(@TempDir Path dir) {
        UUID player = UUID.randomUUID();
        LivesManager manager = individual(dir.resolve("players.yml").toFile(), 3, 5);
        manager.ensurePlayer(player);

        AddResult result = manager.addLives(player, 10);
        assertEquals(5, result.current());
        assertEquals(2, result.added());
    }

    @Test
    void removeLivesReachesZero(@TempDir Path dir) {
        UUID player = UUID.randomUUID();
        LivesManager manager = individual(dir.resolve("players.yml").toFile(), 3, 5);
        manager.ensurePlayer(player);

        RemoveResult partial = manager.removeLives(player, 2);
        assertFalse(partial.reachedZero());

        RemoveResult finalRemoval = manager.removeLives(player, 1);
        assertEquals(0, finalRemoval.current());
        assertTrue(finalRemoval.reachedZero());
    }

    @Test
    void clampToMaximumReducesStoredLives(@TempDir Path dir) {
        UUID player = UUID.randomUUID();
        LivesManager manager = individual(dir.resolve("players.yml").toFile(), 5, 5);
        manager.ensurePlayer(player);

        manager.clampToMaximum(2);
        assertEquals(2, manager.getLives(player));
    }

    @Test
    void sharedLivesAreSharedAcrossPlayers(@TempDir Path dir) {
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        LivesManager manager = shared(dir.resolve("players.yml").toFile(), 3, 5);

        manager.ensurePlayer(first);
        LifeChange change = manager.recordDeath(second);

        assertTrue(change.shared());
        assertEquals(2, manager.getLives(first));
        assertEquals(2, manager.getLives(second));
        assertEquals(1, manager.getDeaths(second));
    }

    @Test
    void dataSurvivesReload(@TempDir Path dir) {
        File file = dir.resolve("players.yml").toFile();
        UUID player = UUID.randomUUID();

        LivesManager first = individual(file, 3, 5);
        first.recordDeath(player);
        first.recordDeath(player);
        first.save();

        LivesManager reloaded = individual(file, 3, 5);
        reloaded.load();
        assertEquals(1, reloaded.getLives(player));
        assertEquals(2, reloaded.getDeaths(player));
    }
}
