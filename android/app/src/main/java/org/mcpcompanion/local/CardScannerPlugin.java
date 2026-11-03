package org.mcpcompanion.local;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import androidx.exifinterface.media.ExifInterface;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/** Local-only capture/picking and bundled Latin OCR. Never accepts arbitrary paths
 * from JavaScript, never reads the user's collection, and never uploads a photo. */
@CapacitorPlugin(name = "CardScanner")
public class CardScannerPlugin extends Plugin {
    private final Map<String, File> photos = new ConcurrentHashMap<>();
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private TextRecognizer recognizer;
    private volatile boolean choosing = false;
    private volatile boolean destroyed = false;
    private File directory;

    @Override public void load() {
        directory = new File(getContext().getCacheDir(), "card-scanner");
        directory.mkdirs();
        recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        // Only this plugin's temporary copies; original gallery images are untouched.
        File[] leftovers = directory.listFiles();
        if (leftovers != null) for (File file : leftovers)
            if (file.lastModified() < System.currentTimeMillis() - TimeUnit.DAYS.toMillis(1)) file.delete();
    }
    private File photoFile(String id) { return new File(directory, id + ".image"); }
    private JSObject description(String id, String name) {
        JSObject result = new JSObject();result.put("id", id);
        result.put("path", Uri.fromFile(photos.get(id)).toString());result.put("name", name);return result;
    }
    @PluginMethod public void choosePhotos(PluginCall call) {
        if (choosing) { call.reject("Выбор фотографии уже открыт.", "SCANNER_BUSY");return; }
        if (photos.size() >= PhotoInputPolicy.MAX_PHOTOS) { call.reject("Можно обработать до 12 фотографий. Уберите лишние снимки.", "PHOTO_LIMIT");return; }
        int max = call.getInt("maxPhotos", PhotoInputPolicy.MAX_PHOTOS);
        if (max < 1 || max > PhotoInputPolicy.MAX_PHOTOS) { call.reject("Можно выбрать до 12 фотографий.", "PHOTO_LIMIT");return; }
        choosing = true;
        try {
            String source = call.getString("source", "gallery");
            Intent intent;
            if ("camera".equals(source)) {
                String id = UUID.randomUUID().toString();File file = photoFile(id);
                if (!file.createNewFile()) throw new IllegalStateException("Не удалось подготовить снимок.");
                photos.put(id, file);call.getData().put("cameraPhotoId", id);
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
                intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                intent.putExtra(MediaStore.EXTRA_OUTPUT, uri);
                intent.setClipData(ClipData.newRawUri("photo", uri));
                intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else if ("gallery".equals(source)) {
                intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, max > 1);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else throw new IllegalArgumentException("Неизвестный источник фотографии.");
            final Intent choiceIntent = intent;
            getActivity().runOnUiThread(() -> {
                try { startActivityForResult(call, choiceIntent, "photosChosen"); }
                catch (Exception error) { choosing = false;deleteCamera(call);call.reject("Не удалось открыть камеру или выбор фото.", "PHOTO_PICK_FAILED", error); }
            });
        } catch (Exception error) {
            choosing = false;deleteCamera(call);
            call.reject("Не удалось открыть камеру или выбор фото. Попробуйте другой способ.", "PHOTO_PICK_FAILED", error);
        }
    }
    private void deleteCamera(PluginCall call) {
        String id = call == null ? null : call.getString("cameraPhotoId");
        if (PhotoInputPolicy.validId(id)) { File f = photos.remove(id);if (f != null) f.delete();else photoFile(id).delete(); }
    }
    @ActivityCallback private void photosChosen(PluginCall call, ActivityResult result) {
        choosing = false;
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) { deleteCamera(call);call.reject("Выбор фотографии отменён.", "SCAN_CANCELLED");return; }
        worker.execute(() -> {
            List<String> added = new ArrayList<>();
            try {
                if (destroyed) throw new IllegalStateException("Экран закрыт. Откройте распознавание снова.");
                JSArray output = new JSArray();String cameraId = call.getString("cameraPhotoId");
                if (PhotoInputPolicy.validId(cameraId)) {
                    File file = photoFile(cameraId);
                    if (!file.isFile() || file.length() <= 0 || file.length() > PhotoInputPolicy.MAX_BYTES) throw new IllegalArgumentException("Снимок пустой или больше 35 МБ. Выберите фото меньшего размера.");
                    photos.put(cameraId, file);added.add(cameraId);output.put(description(cameraId, "Снимок камеры"));
                } else {
                    Intent data = result.getData();LinkedHashSet<Uri> uris = new LinkedHashSet<>();
                    if (data != null && data.getClipData() != null) for (int i = 0; i < data.getClipData().getItemCount(); i++) uris.add(data.getClipData().getItemAt(i).getUri());
                    else if (data != null && data.getData() != null) uris.add(data.getData());
                    int max = call.getInt("maxPhotos", PhotoInputPolicy.MAX_PHOTOS);
                    if (uris.isEmpty()) throw new IllegalArgumentException("Фотографии не выбраны.");
                    if (uris.size() > max) throw new IllegalArgumentException("Выбрано слишком много фото. Можно ещё: " + max + ".");
                    if (uris.size() + photos.size() > PhotoInputPolicy.MAX_PHOTOS) throw new IllegalArgumentException("Сначала уберите лишние снимки: предел — 12 фото.");
                    for (Uri uri : uris) {
                        if (!"content".equals(uri.getScheme())) throw new IllegalArgumentException("Источник фотографии не поддерживается.");
                        String id = UUID.randomUUID().toString();File file = photoFile(id);added.add(id);
                        try (InputStream in = getContext().getContentResolver().openInputStream(uri);FileOutputStream out = new FileOutputStream(file)) {
                            if (in == null) throw new IllegalArgumentException("Нет доступа к фотографии.");
                            byte[] buffer = new byte[32768];long size = 0;int read;
                            while ((read = in.read(buffer)) != -1) { size += read;if (size > PhotoInputPolicy.MAX_BYTES) throw new IllegalArgumentException("Фотография больше 35 МБ. Выберите меньший файл.");out.write(buffer, 0, read); }
                            if (size == 0) throw new IllegalArgumentException("Фотография пустая.");
                        }
                        photos.put(id, file);output.put(description(id, displayName(uri)));
                    }
                }
                JSObject response = new JSObject();response.put("photos", output);call.resolve(response);
            } catch (Exception error) {
                for (String id : added) { photos.remove(id);photoFile(id).delete(); }
                deleteCamera(call);call.reject(error.getMessage() == null ? "Не удалось открыть фото." : error.getMessage(), "PHOTO_READ_FAILED", error);
            }
        });
    }
    private String displayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) return cursor.getString(0);
        } catch (Exception ignored) { }
        return "Фотография";
    }
    private Bitmap decode(File file, int extraRotation) throws Exception {
        BitmapFactory.Options options = new BitmapFactory.Options();options.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(file.getAbsolutePath(), options);
        options.inSampleSize = PhotoInputPolicy.sampleSize(options.outWidth, options.outHeight);options.inJustDecodeBounds = false;
        options.inPreferredConfig = Bitmap.Config.ARGB_8888;
        Bitmap bitmap = BitmapFactory.decodeFile(file.getAbsolutePath(), options);
        if (bitmap == null) throw new IllegalArgumentException("Не удалось прочитать изображение. Попробуйте JPEG или PNG.");
        Matrix exif = new Matrix();
        try {
            int orientation = new ExifInterface(file).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            switch (orientation) {
                case ExifInterface.ORIENTATION_FLIP_HORIZONTAL: exif.setScale(-1, 1);break;
                case ExifInterface.ORIENTATION_ROTATE_180: exif.setRotate(180);break;
                case ExifInterface.ORIENTATION_FLIP_VERTICAL: exif.setScale(1, -1);break;
                case ExifInterface.ORIENTATION_TRANSPOSE: exif.setRotate(90);exif.postScale(-1, 1);break;
                case ExifInterface.ORIENTATION_ROTATE_90: exif.setRotate(90);break;
                case ExifInterface.ORIENTATION_TRANSVERSE: exif.setRotate(-90);exif.postScale(-1, 1);break;
                case ExifInterface.ORIENTATION_ROTATE_270: exif.setRotate(-90);break;
                default: break;
            }
        } catch (java.io.IOException ignored) { /* Some formats have no EXIF header. */ }
        exif.postRotate(extraRotation);
        if (!exif.isIdentity()) { Bitmap transformed = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), exif, true);if (transformed != bitmap) bitmap.recycle();bitmap = transformed; }
        return bitmap;
    }
    @PluginMethod public void recognizePhoto(PluginCall call) {
        String id = call.getString("id");
        if (!PhotoInputPolicy.validId(id) || !photos.containsKey(id)) { call.reject("Фотография больше не доступна. Выберите её снова.", "PHOTO_NOT_FOUND");return; }
        final int rotation;
        try { rotation = PhotoInputPolicy.rotation(call.getInt("rotation", 0)); }
        catch (IllegalArgumentException error) { call.reject(error.getMessage(), "INVALID_ROTATION");return; }
        worker.execute(() -> {
            Bitmap bitmap = null;Task<Text> task = null;
            try {
                File file = photos.get(id);if (destroyed || file == null || !file.isFile()) throw new IllegalArgumentException("Фотография больше не доступна.");
                bitmap = decode(file, rotation);
                final int width = bitmap.getWidth(), height = bitmap.getHeight();
                task = recognizer.process(InputImage.fromBitmap(bitmap, 0));
                Text recognized = Tasks.await(task, 45, TimeUnit.SECONDS);
                JSArray lines = new JSArray();int blockIndex = 0;
                for (Text.TextBlock block : recognized.getTextBlocks()) {
                    for (Text.Line line : block.getLines()) {
                        JSObject item = new JSObject();item.put("text", line.getText());item.put("block", blockIndex);
                        Rect r = line.getBoundingBox();
                        if (r != null) { JSObject box = new JSObject();box.put("x", (double)r.left / width);box.put("y", (double)r.top / height);box.put("w", (double)r.width() / width);box.put("h", (double)r.height() / height);item.put("box", box); }
                        lines.put(item);
                    }
                    blockIndex++;
                }
                JSObject response = new JSObject();response.put("text", recognized.getText());response.put("lines", lines);response.put("width", width);response.put("height", height);response.put("engine", "mlkit-latin");call.resolve(response);
            } catch (OutOfMemoryError error) { call.reject("Недостаточно памяти для этого фото. Снимите меньше карт за раз.", "PHOTO_MEMORY"); }
            catch (Exception error) { call.reject("Не удалось распознать фото. Попробуйте повернуть его или снять карты ближе.", "OCR_FAILED", error); }
            finally {
                if (bitmap != null) {
                    final Bitmap image = bitmap;
                    if (task != null && !task.isComplete()) task.addOnCompleteListener(done -> image.recycle());
                    else image.recycle();
                }
            }
        });
    }
    @PluginMethod public void releasePhotos(PluginCall call) {
        JSArray ids = call.getArray("ids", new JSArray());
        // Queued behind decoding, so cancellation never removes a file mid-read.
        worker.execute(() -> {
            for (int i = 0; i < Math.min(ids.length(), PhotoInputPolicy.MAX_PHOTOS); i++) {
                String id = ids.optString(i, "");if (!PhotoInputPolicy.validId(id)) continue;
                File file = photos.remove(id);if (file != null) file.delete();
            }
            call.resolve();
        });
    }
    @Override protected Bundle saveInstanceState() { return super.saveInstanceState(); }
    @Override protected void handleOnDestroy() {
        destroyed = true;
        worker.execute(() -> { recognizer.close();for (File file : photos.values()) file.delete();photos.clear(); });
        worker.shutdown();
    }
}
