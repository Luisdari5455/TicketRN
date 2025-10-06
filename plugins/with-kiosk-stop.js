// plugins/with-kiosk-stop.js
const { withMainApplication } = require('@expo/config-plugins');

module.exports = function withKioskStop(config) {
  return withMainApplication(config, (c) => {
    const file = c.modResults;
    let contents = file.contents;

    // Import
    if (!contents.includes('import com.tuempresa.kiosk.KioskPackage')) {
      contents = contents.replace(
        /import com.facebook.react.PackageList;?\n/,
        (m) => m + 'import com.tuempresa.kiosk.KioskPackage;\n'
      );
    }

    // Registro del paquete
    const marker = 'new PackageList(this).getPackages()';
    if (contents.includes(marker) && !contents.includes('new KioskPackage()')) {
      contents = contents.replace(
        /new PackageList\(this\)\.getPackages\(\)/,
        'new PackageList(this).getPackages()\n        '
        + '.plus(new KioskPackage())'
      );
    }

    file.contents = contents;
    return c;
  });
};
