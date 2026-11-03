package org.mcpcompanion.local;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        // Register before BridgeActivity constructs the JS/native bridge.
        registerPlugin(CardScannerPlugin.class);
        registerPlugin(LocalDataPlugin.class);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (bridge == null || bridge.getWebView() == null) { finish();return; }
                bridge.getWebView().evaluateJavascript("(function(){var a=Array.from(document.querySelectorAll('dialog[open]'));var d=a[a.length-1];if(!d)return false;var e=new Event('cancel',{cancelable:true});if(d.dispatchEvent(e))d.close();return true;})()", handled -> {
                    if (!"true".equals(handled)) {
                        if (bridge.getWebView().canGoBack()) bridge.getWebView().goBack();
                        else finish();
                    }
                });
            }
        });
    }
}
