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
  fun stopLockTask(promise: Promise) {
    try {
      val activity: Activity? = currentActivity
      if (activity != null) {
        activity.stopLockTask()   // <- clave: rompe Lock Task real
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
