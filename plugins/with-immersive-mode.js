const { withMainActivity } = require('@expo/config-plugins');

module.exports = function withImmersiveMode(config) {
  return withMainActivity(config, (c) => {
    let src = c.modResults.contents;

    // Import
    if (!src.includes('import android.view.View')) {
      src = src.replace(
        /import android.os.Bundle;?\n/,
        (m) => m + 'import android.view.View;\n'
      );
    }

    // Método helper
    if (!src.includes('void enableStickyImmersive()')) {
      src = src.replace(
        /public class MainActivity extends ReactActivity \{\n/,
`public class MainActivity extends ReactActivity {
  private void enableStickyImmersive() {
    final View decor = getWindow().getDecorView();
    decor.setSystemUiVisibility(
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
      | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
      | View.SYSTEM_UI_FLAG_FULLSCREEN
      | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
      | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
      | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    );
  }

`
      );
    }

    // Llamar en onCreate
    if (!src.includes('enableStickyImmersive();')) {
      src = src.replace(
        /protected void onCreate\(Bundle savedInstanceState\) \{\n\s*super.onCreate\(savedInstanceState\);\n/,
        `protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    enableStickyImmersive();
`
      );
    }

    // Reaplicar cuando recupere foco
    if (!src.includes('onWindowFocusChanged(boolean hasFocus)')) {
      src = src.replace(
        /}\n\s*}\n?$/s,
`  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) {
      enableStickyImmersive();
    }
  }
}
`
      );
    }

    c.modResults.contents = src;
    return c;
  });
};
