package uy.edualex.hardcoresounds.service;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;

public final class CooldownService {
    private final LongSupplier timeSource;
    private final Map<UUID, Long> senderUses = new HashMap<>();
    private long globalUse = Long.MIN_VALUE;

    public CooldownService() {
        this(() -> TimeUnit.NANOSECONDS.toMillis(System.nanoTime()));
    }

    CooldownService(LongSupplier timeSource) {
        this.timeSource = timeSource;
    }

    public synchronized long tryAcquire(UUID sender, boolean enabled, long senderMillis, long globalMillis) {
        if (!enabled) return 0;
        long now = timeSource.getAsLong();
        long senderRemaining = remaining(now, senderUses.getOrDefault(sender, Long.MIN_VALUE), senderMillis);
        long globalRemaining = remaining(now, globalUse, globalMillis);
        long remaining = Math.max(senderRemaining, globalRemaining);
        if (remaining > 0) return remaining;
        senderUses.put(sender, now);
        globalUse = now;
        return 0;
    }

    private static long remaining(long now, long previous, long duration) {
        if (previous == Long.MIN_VALUE || duration <= 0) return 0;
        return Math.max(0, duration - (now - previous));
    }

    public synchronized void remove(UUID sender) {
        senderUses.remove(sender);
    }

    public synchronized void clear() {
        senderUses.clear();
        globalUse = Long.MIN_VALUE;
    }
}
