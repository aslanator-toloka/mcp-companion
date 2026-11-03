package org.mcpcompanion.local;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

@CapacitorPlugin(name = "LocalData")
public class LocalDataPlugin extends Plugin {
    private boolean choosing = false;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    @PluginMethod public void saveExport(PluginCall call) {
        if (choosing) { call.reject("Сначала завершите сохранение текущего файла.","EXPORT_BUSY");return; }
        String text = call.getString("json", "");
        if (text.length() > 20 * 1024 * 1024) { call.reject("Экспорт больше 20 МБ. Попробуйте сохранить данные через браузерную версию.","EXPORT_TOO_LARGE");return; }
        try { if (new JSONObject(text).getInt("version") != 1) throw new IllegalArgumentException(); }
        catch (Exception error) { call.reject("Некорректный файл экспорта.","INVALID_EXPORT");return; }
        choosing = true;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");intent.putExtra(Intent.EXTRA_TITLE,"mcp-companion-catalog.json");
        getActivity().runOnUiThread(() -> {
            try { startActivityForResult(call,intent,"exportChosen"); }
            catch (Exception error) { choosing = false;call.reject("Не удалось открыть сохранение файла.","EXPORT_FAILED",error); }
        });
    }
    @ActivityCallback private void exportChosen(PluginCall call, ActivityResult result) {
        choosing = false;if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) { call.reject("Сохранение отменено.","EXPORT_CANCELLED");return; }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (uri == null || !"content".equals(uri.getScheme())) { call.reject("Не удалось получить выбранный файл.","EXPORT_FAILED");return; }
        worker.execute(() -> {
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri,"wt")) {
                if (output == null) throw new IllegalArgumentException("Не удалось открыть файл для записи.");
                output.write(call.getString("json", "").getBytes(StandardCharsets.UTF_8));call.resolve();
            } catch (Exception error) { call.reject("Не удалось сохранить файл. Выберите другое место.","EXPORT_FAILED",error); }
        });
    }
    @Override protected void handleOnDestroy() { worker.shutdown(); }
}
