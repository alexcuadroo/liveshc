package uy.edualex.hardcoresounds.util;

import java.util.Locale;
import java.util.Optional;

public final class Validation {
    private Validation() {}

    public static boolean isSha1(String value) {
        return value != null && value.matches("(?i)[0-9a-f]{40}");
    }

    public static Optional<String> normalizeId(String value) {
        if (value == null) return Optional.empty();
        String normalized = value.toLowerCase(Locale.ROOT);
        return normalized.matches("[a-z0-9._-]+") ? Optional.of(normalized) : Optional.empty();
    }

    public static boolean validVolume(double value) {
        return Double.isFinite(value) && value >= 0.0 && value <= Float.MAX_VALUE;
    }

    public static boolean validPitch(double value) {
        return Double.isFinite(value) && value >= 0.5 && value <= 2.0;
    }
}
