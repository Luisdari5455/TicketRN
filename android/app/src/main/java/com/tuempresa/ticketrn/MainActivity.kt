package com.tuempresa.ticketrn

import android.os.Bundle
import android.view.View
import androidx.core.view.WindowCompat
import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {

  // En proyectos Expo el nombre del componente raíz es "main"
  override fun getMainComponentName(): String = "main"

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Edge-to-edge (SDK 35+)
    WindowCompat.setDecorFitsSystemWindows(window, false)
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      enableStickyImmersive()
    }
  }

  // Implementación local del modo inmersivo (evita la referencia no resuelta)
  private fun enableStickyImmersive() {
    @Suppress("DEPRECATION")
    window.decorView.systemUiVisibility =
      (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        or View.SYSTEM_UI_FLAG_FULLSCREEN)
  }
}
