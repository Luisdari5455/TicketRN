package com.tuempresa.kiosk

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
