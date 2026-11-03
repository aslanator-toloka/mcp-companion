package org.mcpcompanion.local;

import static org.junit.Assert.*;
import static androidx.test.espresso.intent.Intents.intending;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasAction;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.net.Uri;
import android.provider.MediaStore;
import androidx.core.content.FileProvider;
import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.Espresso;
import androidx.test.espresso.intent.Intents;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real Capacitor bridge + real bundled ML Kit on Android. Only the external
 * document picker is stubbed, returning a content URI to a public card fixture. */
@RunWith(AndroidJUnit4.class)
public class CardScannerIntegrationTest {
    private ActivityScenario<MainActivity> activity;
    @Before public void start() throws Exception {
        Intents.init();activity = ActivityScenario.launch(MainActivity.class);
        await("window.MCPStores && MCPStores.ui.ready", 30000);
        js("MCPStores.rosters.open();true");
        await("!!MCPStores.rosters.draft", 5000);
    }
    @After public void stop() {
        if (activity != null) activity.close();Intents.release();
    }
    private String js(String code) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);AtomicReference<String> value = new AtomicReference<>();
        activity.onActivity(a -> a.getBridge().getWebView().evaluateJavascript(code, text -> { value.set(text);latch.countDown(); }));
        assertTrue("WebView callback timed out", latch.await(8, TimeUnit.SECONDS));return value.get();
    }
    private void await(String expression, int timeout) throws Exception {
        long end = System.currentTimeMillis() + timeout;
        while (System.currentTimeMillis() < end) { if ("true".equals(js("!!(" + expression + ")"))) return;Thread.sleep(150); }
        fail("Timed out: " + expression + "; OCR state: " + js("JSON.stringify(window.MCPStores && {error:MCPStores.photoImport.error, photos:MCPStores.photoImport.photos.map(p=>({error:p.error,text:p.result?.text})),rows:MCPStores.photoImport.rows.map(r=>({slug:r.slug,name:r.name}))})"));
    }
    private void pick(String filename, String kind) throws Exception {
        pickTarget(filename, "MCPStores.photoImport.openRoster('" + kind + "')");
    }
    private void pickTarget(String filename, String openTarget) throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File directory = new File(context.getCacheDir(), "card-scanner");directory.mkdirs();
        File file = new File(directory, "fixture-" + filename);
        try (InputStream in = InstrumentationRegistry.getInstrumentation().getContext().getAssets().open(filename);FileOutputStream out = new FileOutputStream(file)) {
            byte[] bytes = new byte[32768];int read;while ((read = in.read(bytes)) != -1) out.write(bytes,0,read);
        }
        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
        intending(hasAction(Intent.ACTION_OPEN_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK, new Intent().setData(uri)));
        js(openTarget + ";MCPStores.photoImport.chooseNative('gallery');true");
        await("!MCPStores.photoImport.busy && MCPStores.photoImport.photos.length === 1 && !!MCPStores.photoImport.photos[0].result", 60000);
    }
    private JSONArray slugs() throws Exception {
        return new JSONArray((String)new JSONTokener(js("JSON.stringify(MCPStores.photoImport.rows.map(r=>r.slug))")).nextValue());
    }
    private void expectAndApply(String kind, String... expected) throws Exception {
        String found = slugs().toString();for (String slug : expected) assertTrue("Missing " + slug + " in " + found, found.contains('"' + slug + '"'));
        String selected = new JSONArray(Arrays.asList(expected)).toString();
        js("MCPStores.photoImport.rows.forEach(r=>MCPStores.photoImport.toggleRow(r.key," + selected + ".includes(r.slug)));MCPStores.photoImport.apply();true");
        await("!MCPStores.photoImport.target",10000);
        String result = js("JSON.stringify(MCPStores.rosters.draft['" + kind + "'])");
        for (String slug:expected) assertTrue(result, result.contains(slug));
    }
    @Test public void twoCharacterCardsAreRecognizedAndConfirmedIntoRoster() throws Exception {
        pick("characters.jpg", "characters");
        saveScreenshot("native-characters.png");
        expectAndApply("characters","ultimate-spider-man","amazing-spider-man");
    }
    @Test public void tacticCardIsRecognizedAndConfirmedIntoRoster() throws Exception {
        pick("tactic.jpg", "tactics");expectAndApply("tactics","clone-saga");
    }
    @Test public void crisisCardIsRecognizedAndConfirmedIntoRoster() throws Exception {
        pick("crisis.jpg", "crises");expectAndApply("crises","power-overload-factory-goes-up-in-flames");
    }
    @Test public void exifOrientedCameraImageIsDecodedUpright() throws Exception {
        pick("characters-exif.jpg", "characters");
        assertEquals("true",js("MCPStores.photoImport.photos[0].result.width > MCPStores.photoImport.photos[0].result.height"));
        expectAndApply("characters","ultimate-spider-man","amazing-spider-man");
    }
    @Test public void androidBackClosesReviewWithoutAddingAnything() throws Exception {
        pick("tactic.jpg", "tactics");Espresso.pressBack();
        await("!MCPStores.photoImport.target",5000);assertEquals("0",js("MCPStores.rosters.draft.tactics.length"));
    }
    @Test public void documentPickerCancellationIsNotShownAsAnError() throws Exception {
        intending(hasAction(Intent.ACTION_OPEN_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_CANCELED,null));
        js("MCPStores.photoImport.openRoster('characters');MCPStores.photoImport.chooseNative('gallery');true");
        await("!MCPStores.photoImport.busy",5000);assertEquals("\"\"",js("MCPStores.photoImport.error"));assertEquals("0",js("MCPStores.photoImport.photos.length"));
    }
    @Test public void nativeRecognizerRejectsAnArbitraryFilePath() throws Exception {
        js("window.__badPhotoError=null;MCPStores.photoImport.recognizer.recognize({native:true,id:'../../private',rotation:0}).catch(e=>window.__badPhotoError=e.code);true");
        await("window.__badPhotoError !== null",5000);assertEquals("\"PHOTO_NOT_FOUND\"",js("window.__badPhotoError"));
    }
    private void saveScreenshot(String name) throws Exception {
        await("Array.from(document.querySelectorAll('#photo-import-dialog .photo-result-avatar')).every(i=>i.complete && i.naturalWidth>0)",10000);
        Thread.sleep(250);
        Bitmap bitmap = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        try (FileOutputStream out = new FileOutputStream(new File(context.getFilesDir(),name))) { bitmap.compress(Bitmap.CompressFormat.PNG,100,out); }
        bitmap.recycle();
    }
    private Instrumentation.ActivityMonitor cameraMonitor(boolean cancelled) {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        Context context = instrumentation.getTargetContext();
        Instrumentation.ActivityMonitor monitor = new Instrumentation.ActivityMonitor() {
            @Override public Instrumentation.ActivityResult onStartActivity(Intent intent) {
                if (!MediaStore.ACTION_IMAGE_CAPTURE.equals(intent.getAction())) return null;
                if (cancelled) return new Instrumentation.ActivityResult(Activity.RESULT_CANCELED,null);
                Uri output = intent.getParcelableExtra(MediaStore.EXTRA_OUTPUT);
                assertNotNull("Camera must receive a full-size output URI, not just a thumbnail",output);
                assertEquals("content",output.getScheme());
                try (InputStream in = instrumentation.getContext().getAssets().open("characters.jpg");OutputStream out = context.getContentResolver().openOutputStream(output)) {
                    byte[] data = new byte[32768];int read;while ((read=in.read(data))!=-1) out.write(data,0,read);
                } catch (Exception error) { throw new AssertionError(error); }
                return new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent());
            }
        };
        instrumentation.addMonitor(monitor);return monitor;
    }
    @Test public void fullSizeCameraOutputTravelsThroughNativeOcrIntoRoster() throws Exception {
        Instrumentation.ActivityMonitor monitor = cameraMonitor(false);
        try {
            js("MCPStores.photoImport.openRoster('characters');MCPStores.photoImport.chooseNative('camera');true");
            await("!MCPStores.photoImport.busy && MCPStores.photoImport.photos.length===1 && !!MCPStores.photoImport.photos[0].result",60000);
            expectAndApply("characters","ultimate-spider-man","amazing-spider-man");
        } finally { InstrumentationRegistry.getInstrumentation().removeMonitor(monitor); }
    }
    @Test public void cancelledCameraReturnsWithoutAddingOrShowingAnError() throws Exception {
        Instrumentation.ActivityMonitor monitor = cameraMonitor(true);
        try {
            js("MCPStores.photoImport.openRoster('characters');MCPStores.photoImport.chooseNative('camera');true");
            await("!MCPStores.photoImport.busy",5000);assertEquals("\"\"",js("MCPStores.photoImport.error"));assertEquals("0",js("MCPStores.photoImport.photos.length"));
        } finally { InstrumentationRegistry.getInstrumentation().removeMonitor(monitor); }
    }
    @Test public void nativeOcrAlsoFormsOpponentSquadWithoutEditingTheSourceRoster() throws Exception {
        js("MCPStores.rosters.setField('name','Native battle');MCPStores.rosters.choose('characters','hulk',true);window.__rosterId=MCPStores.rosters.draft.id;MCPStores.rosters.save();MCPStores.battle.prepare(window.__rosterId);true");
        await("!!MCPStores.battle.current",5000);
        pickTarget("characters.jpg","MCPStores.photoImport.openBattle('opponent','characters')");
        assertTrue(slugs().toString().contains("ultimate-spider-man"));
        js("MCPStores.photoImport.rows.forEach(r=>MCPStores.photoImport.toggleRow(r.key,['ultimate-spider-man','amazing-spider-man'].includes(r.slug)));MCPStores.photoImport.apply();true");
        await("!MCPStores.photoImport.target",10000);
        assertEquals("2",js("MCPStores.battle.current.opponent.fighters.length"));
        assertEquals("1",js("MCPStores.battle.current.sourceRoster.characters.length"));
    }
    @Test public void libraryExportUsesSystemDocumentPickerAndWritesActualUtf8Json() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File directory = new File(context.getCacheDir(),"card-scanner");directory.mkdirs();
        File output = new File(directory,"export-native.json");
        try (FileOutputStream out = new FileOutputStream(output)) { out.write("old contents".getBytes(java.nio.charset.StandardCharsets.UTF_8)); }
        Uri uri = FileProvider.getUriForFile(context,context.getPackageName()+".fileprovider",output);
        intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(uri)));
        js("MCPStores.rosters.setField('name','Экспорт OCR');MCPStores.rosters.save();window.__exportDone=false;MCPStores.ui.actions.export().then(()=>window.__exportDone=true);true");
        await("window.__exportDone",10000);
        String text = new String(java.nio.file.Files.readAllBytes(output.toPath()),java.nio.charset.StandardCharsets.UTF_8);
        JSONObject data = new JSONObject(text);assertEquals(1,data.getInt("version"));assertTrue(data.has("battles"));
        assertTrue(text.contains("Экспорт OCR"));assertFalse(text.contains("old contents"));assertFalse(text.contains("card-scanner/"));
    }
    @Test public void cancellingSystemExportKeepsDataAndAllowsRetry() throws Exception {
        intending(hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_CANCELED,null));
        js("window.__exportDone=false;MCPStores.ui.actions.export().then(()=>window.__exportDone=true);true");await("window.__exportDone",10000);
        assertEquals("true",js("!!MCPStores.rosters.draft"));
        js("window.__exportDone=false;MCPStores.ui.actions.export().then(()=>window.__exportDone=true);true");await("window.__exportDone",10000);
        assertEquals("true",js("!!MCPStores.rosters.draft"));
    }
}
