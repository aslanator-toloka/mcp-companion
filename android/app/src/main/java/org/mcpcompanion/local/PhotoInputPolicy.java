package org.mcpcompanion.local;

/** Small deterministic policy shared by decoding and its JVM tests. */
public final class PhotoInputPolicy {
    public static final int MAX_PHOTOS = 12;
    public static final long MAX_BYTES = 35L * 1024 * 1024;
    public static final int MAX_EDGE = 3200;
    private PhotoInputPolicy() {}
    public static int sampleSize(int width, int height) {
        if (width <= 0 || height <= 0 || (long) width * height > 200_000_000L)
            throw new IllegalArgumentException("Файл не похож на фотографию или слишком большой.");
        int sample = 1;
        while ((Math.max(width, height) + sample - 1) / sample > MAX_EDGE) sample *= 2;
        return sample;
    }
    public static int rotation(int value) {
        if (value % 90 != 0) throw new IllegalArgumentException("Поворот должен быть кратен 90 градусам.");
        return ((value % 360) + 360) % 360;
    }
    public static boolean validId(String value) {
        return value != null && value.matches("[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}");
    }
}
