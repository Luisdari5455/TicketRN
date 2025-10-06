const { withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const KIOSK_PACKAGE_PATH = ['app','src','main','java','com','tuempresa','kiosk'];

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
  fun stopLockTask(promise: Promise) {
    try {
      val activity: Activity? = currentActivity
      if (activity != null) {
        activity.stopLockTask()
        promise.resolve(true)
      } else {
        promise.reject("NO_ACTIVITY", "No current activity")
      }
    } catch (e: Exception) {
      promise.reject("STOP_LOCK_TASK_FAIL", e)
    }
  }

  @ReactMethod
  fun startLockTask(promise: Promise) {
    try {
      val activity: Activity? = currentActivity
      if (activity != null) {
        activity.startLockTask()
        promise.resolve(true)
      } else {
        promise.reject("NO_ACTIVITY", "No current activity")
      }
    } catch (e: Exception) {
      promise.reject("START_LOCK_TASK_FAIL", e)
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
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, contents, { encoding: 'utf8' });
}

module.exports = function withKioskNative(config) {
  // 1) Escribir los .kt tras prebuild
  config = withDangerousMod(config, ['android', async (c) => {
    const androidDir = c.modRequest.platformProjectRoot; // <project>/android
    const pkgDir = path.join(androidDir, ...KIOSK_PACKAGE_PATH);
    ensureFile(path.join(pkgDir, 'KioskModule.kt'), kioskModuleKt);
    ensureFile(path.join(pkgDir, 'KioskPackage.kt'), kioskPackageKt);
    return c;
  }]);

  // 2) Inyectar import + registro en MainApplication
  config = withMainApplication(config, (c) => {
    let src = c.modResults.contents;

    if (!src.includes('import com.tuempresa.kiosk.KioskPackage')) {
      src = src.replace(
        /import com.facebook.react.PackageList;?\n/,
        (m) => m + 'import com.tuempresa.kiosk.KioskPackage;\n'
      );
    }

    const marker = 'new PackageList(this).getPackages()';
    if (src.includes(marker) && !src.includes('new KioskPackage()')) {
      src = src.replace(
        /new PackageList\(this\)\.getPackages\(\)/,
        'new PackageList(this).getPackages()\n        .plus(new KioskPackage())'
      );
    }

    c.modResults.contents = src;
    return c;
  });

  return config;
};
