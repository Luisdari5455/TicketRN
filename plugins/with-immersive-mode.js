// plugins/with-immersive-mode.js
const { withMainActivity } = require('@expo/config-plugins');

function insertImportsKotlin(src) {
  const need = [
    'androidx.core.view.WindowCompat',
    'androidx.core.view.WindowInsetsCompat',
    'androidx.core.view.WindowInsetsControllerCompat',
  ];
  const missing = need.filter((i) => !src.includes(i));
  if (missing.length === 0) return src;
  // inserta después de la primera tanda de imports
  return src.replace(
    /(import [^\n]+\n)(?!import)/,
    (m) =>
      m +
      missing
        .map((i) => `import ${i}\n`)
        .join('')
  );
}

function insertKotlinMethods(src) {
  let tail = '';

  if (!src.includes('override fun onWindowFocusChanged(')) {
    tail += `
  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) enableStickyImmersive()
  }
`;
  }

  if (!src.includes('fun enableStickyImmersive(')) {
    tail += `
  private fun enableStickyImmersive() {
    WindowCompat.setDecorFitsSystemWindows(window, false)
    val controller = androidx.core.view.WindowInsetsControllerCompat(window, window.decorView)
    controller.systemBarsBehavior =
      androidx.core.view.WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    controller.hide(
      androidx.core.view.WindowInsetsCompat.Type.statusBars() or
      androidx.core.view.WindowInsetsCompat.Type.navigationBars()
    )
  }
`;
  }

  if (!tail) return src;
  // inserta antes del último }
  return src.replace(/\}\s*$/s, `${tail}\n}\n`);
}

function fixJava(src) {
  // Sólo por si algún proyecto usa MainActivity.java
  if (!src.includes('import android.view.View;')) {
    src = src.replace(/import android\.os\.Bundle;?\n/, (m) => m + 'import android.view.View;\n');
  }
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
  if (!src.includes('enableStickyImmersive();')) {
    src = src.replace(
      /protected void onCreate\(Bundle savedInstanceState\) \{\s*super\.onCreate\(savedInstanceState\);\n/s,
      `protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    enableStickyImmersive();
`
    );
  }
  if (!src.includes('onWindowFocusChanged(boolean hasFocus)')) {
    src = src.replace(
      /\}\s*\}\s*$/s,
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
  return src;
}

module.exports = function withImmersiveMode(config) {
  return withMainActivity(config, (c) => {
    let src = c.modResults.contents;
    const isKotlin = c.modResults.language === 'kt';

    if (isKotlin) {
      src = insertImportsKotlin(src);
      src = insertKotlinMethods(src);
    } else {
      src = fixJava(src);
    }

    c.modResults.contents = src;
    return c;
  });
};
