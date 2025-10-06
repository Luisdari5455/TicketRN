// plugins/with-kiosk-native.js
const { withDangerousMod, withMainApplication, withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const KIOSK_PACKAGE = ['app','src','main','java','com','tuempresa','kiosk'];

const kioskModuleKt = `package com.tuempresa.kiosk

import android.app.Activity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class KioskModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "KioskMode"

  @ReactMethod
  fun startLockTask(promise: Promise) {
    try {
      val activity: Activity? = currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "No current activity")
        return
      }
      activity.runOnUiThread {
        try {
          activity.startLockTask()
          promise.resolve(true)
        } catch (e: Exception) {
          promise.reject("START_LOCK_TASK_FAIL", e)
        }
      }
    } catch (e: Exception) {
      promise.reject("START_LOCK_TASK_FAIL", e)
    }
  }

  @ReactMethod
  fun stopLockTask(promise: Promise) {
    try {
      val activity: Activity? = currentActivity
      if (activity == null) {
        promise.reject("NO_ACTIVITY", "No current activity")
        return
      }
      activity.runOnUiThread {
        try {
          activity.stopLockTask()
          promise.resolve(true)
        } catch (e: Exception) {
          promise.reject("STOP_LOCK_TASK_FAIL", e)
        }
      }
    } catch (e: Exception) {
      promise.reject("STOP_LOCK_TASK_FAIL", e)
    }
  }
}
`;

const kioskPackageKt = `package com.tuempresa.kiosk

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class KioskPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(KioskModule(reactContext))
  }
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`;

function ensureFile(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== contents) {
    fs.writeFileSync(file, contents, 'utf8');
  }
}

module.exports = function withKioskNative(config) {
  // 1) Escribir los .kt
  config = withDangerousMod(config, ['android', async (c) => {
    const androidDir = c.modRequest.platformProjectRoot;
    const pkgDir = path.join(androidDir, ...KIOSK_PACKAGE);
    ensureFile(path.join(pkgDir, 'KioskModule.kt'), kioskModuleKt);
    ensureFile(path.join(pkgDir, 'KioskPackage.kt'), kioskPackageKt);
    return c;
  }]);

  // 2) Registrar KioskPackage en MainApplication (soporta Kotlin y Java)
  config = withMainApplication(config, (c) => {
    let src = c.modResults.contents;
    const isKotlin = c.modResults.language === 'kt';

    if (isKotlin) {
      if (!src.includes('import com.tuempresa.kiosk.KioskPackage')) {
        // Inserta después de otros imports
        src = src.replace(/(import [^\n]+\n)(?!import)/, (m) => m + `import com.tuempresa.kiosk.KioskPackage\n`);
      }
      if (!src.includes('packages.add(KioskPackage())')) {
        src = src.replace(
          /val packages = PackageList\(this\)\.packages/,
          `val packages = PackageList(this).packages\n        packages.add(KioskPackage())`
        );
      }
    } else {
      if (!src.includes('import com.tuempresa.kiosk.KioskPackage;')) {
        src = src.replace(
          /import com\.facebook\.react\.PackageList;?\n/,
          (m) => m + 'import com.tuempresa.kiosk.KioskPackage;\n'
        );
      }
      if (!src.includes('new KioskPackage()')) {
        src = src.replace(
          /List<ReactPackage> packages = new PackageList\(this\)\.getPackages\(\);/,
          `List<ReactPackage> packages = new PackageList(this).getPackages();\n      packages.add(new KioskPackage());`
        );
      }
    }

    c.modResults.contents = src;
    return c;
  });

  // 3) Opcional: lockTaskMode en el Manifest (no rompe si ya existe)
  config = withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application?.[0];
    if (app?.activity?.length) {
      const act = app.activity.find(
        (a) =>
          a['$']?.['android:name'] === '.MainActivity' ||
          (a['$']?.['android:name'] || '').endsWith('MainActivity')
      );
      if (act) {
        if (!act['$']) act['$'] = {};
        if (!act['$']['android:lockTaskMode']) {
          act['$']['android:lockTaskMode'] = 'if_whitelisted';
        }
      }
    }
    return c;
  });

  return config;
};
