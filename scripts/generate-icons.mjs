/**
 * Generate PWA icons for Korent.
 * Run with: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

const BRAND_COLOR = "#1e5dcf";

function svgIcon(size, padding = 0) {
  const inset = padding;
  const boxSize = size - inset * 2;
  const radius = Math.round(boxSize * 0.22);
  const fontSize = Math.round(boxSize * 0.55);
  const cx = size / 2;
  const cy = size / 2;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect x="${inset}" y="${inset}" width="${boxSize}" height="${boxSize}" rx="${radius}" fill="${BRAND_COLOR}"/>
  <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
    font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif"
    font-weight="800" font-size="${fontSize}" fill="#ffffff">K</text>
</svg>`);
}

async function generate() {
  // 192x192
  await sharp(svgIcon(192))
    .png()
    .toFile(join(PUBLIC, "icon-192x192.png"));

  // 512x512
  await sharp(svgIcon(512))
    .png()
    .toFile(join(PUBLIC, "icon-512x512.png"));

  // 180x180 apple-touch-icon
  await sharp(svgIcon(180))
    .png()
    .toFile(join(PUBLIC, "apple-touch-icon.png"));

  // 512x512 maskable (extra padding — safe zone is inner 80%)
  const maskPadding = Math.round(512 * 0.1);
  await sharp(svgIcon(512, maskPadding))
    .png()
    .toFile(join(PUBLIC, "icon-maskable-512x512.png"));

  // 32x32 favicon as PNG, then wrap in ICO
  const favicon32 = await sharp(svgIcon(32)).png().toBuffer();
  // Write as favicon.png — browsers accept it; for .ico we do a simple wrap
  writeFileSync(join(PUBLIC, "favicon.ico"), createIco(favicon32, 32));

  // SVG favicon
  const svgFavicon = svgIcon(32).toString("utf-8");
  writeFileSync(join(PUBLIC, "favicon.svg"), svgFavicon);

  console.log("Icons generated in public/");
}

/** Minimal ICO container for a single 32x32 PNG */
function createIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);     // reserved
  header.writeUInt16LE(1, 2);     // ICO type
  header.writeUInt16LE(1, 4);     // 1 image

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0);      // width
  entry.writeUInt8(size, 1);      // height
  entry.writeUInt8(0, 2);         // color palette
  entry.writeUInt8(0, 3);         // reserved
  entry.writeUInt16LE(1, 4);      // color planes
  entry.writeUInt16LE(32, 6);     // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8);  // size of PNG data
  entry.writeUInt32LE(22, 12);    // offset (6 header + 16 entry = 22)

  return Buffer.concat([header, entry, pngBuffer]);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
