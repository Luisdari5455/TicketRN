// tools/generate-icons.js
// Genera iconos cuadrados desde assets/EEMQ2.png usando sharp (sin ImageMagick).
// Crea: assets/icon-1024.png, assets/adaptive-icon-foreground.png, assets/splash-2000.png

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC = path.resolve(__dirname, "../assets/EEMQ2.png"); // tu fuente rectangular
const OUT_DIR = path.resolve(__dirname, "../assets");

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function makeSquare({
  src,
  size,
  out,
  background = { r: 255, g: 255, b: 255, alpha: 1 },
  fit = "contain", // contain = agrega borde para cuadrar; cover = recorta
  padding = 0,     // padding para dejar margen
}) {
  // Nota: 'contain' deja bordes para cuadrar; con fondo sólido o transparente
  const image = sharp(src);
  const metadata = await image.metadata();

  // Si quieres transparencia, cambia background a { r:0,g:0,b:0,alpha:0 }
  await image
    .resize({
      width: size - padding * 2,
      height: size - padding * 2,
      fit,
      withoutEnlargement: false,
    })
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background,
    })
    .resize(size, size, { fit: "contain", background })
    .png()
    .toFile(out);

  console.log(`✔ ${out} (${size}x${size}) generado desde ${metadata.width}x${metadata.height}`);
}

(async () => {
  await ensureDir(OUT_DIR);

  const srcExists = fs.existsSync(SRC);
  if (!srcExists) {
    console.error(`✖ No se encontró ${SRC}. Asegúrate que assets/EEMQ2.png exista.`);
    process.exit(1);
  }

  // 1) icon-1024.png — fondo blanco (sin transparencia)
  await makeSquare({
    src: SRC,
    size: 1024,
    out: path.join(OUT_DIR, "icon-1024.png"),
    background: { r: 255, g: 255, b: 255, alpha: 1 },
    fit: "contain",
    padding: 0,
  });

  // 2) adaptive-icon-foreground.png — con transparencia y margen (quedará centrado)
  await makeSquare({
    src: SRC,
    size: 1024,
    out: path.join(OUT_DIR, "adaptive-icon-foreground.png"),
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    fit: "contain",
    padding: 112, // deja borde alrededor (ajústalo si deseas)
  });

  // 3) splash-2000.png — para splash (blanco, cuadrado grande)
  await makeSquare({
    src: SRC,
    size: 2000,
    out: path.join(OUT_DIR, "splash-2000.png"),
    background: { r: 255, g: 255, b: 255, alpha: 1 },
    fit: "contain",
    padding: 0,
  });

  console.log("🎉 Listo. Commit a estos archivos y construye en EAS.");
})();
