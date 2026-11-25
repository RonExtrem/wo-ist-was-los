// Erzeugt die App-Symbole aus design/icon.svg (einmalig ausführen: node scripts/make-icons.mjs)
import sharp from "sharp";
import { readFile } from "node:fs/promises";

const icon = await readFile("design/icon.svg");
const badge = await readFile("design/badge.svg");

for (const size of [192, 512]) {
  await sharp(icon).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
}
// "maskable": Android schneidet das Symbol rund/eckig zu, daher Rand lassen
await sharp(icon).resize(410, 410).extend({ top: 51, bottom: 51, left: 51, right: 51, background: "#E8F6F5" }).png().toFile("public/icons/maskable-512.png");
await sharp(icon).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");
await sharp(badge).resize(96, 96).png().toFile("public/icons/badge-96.png");
await sharp(icon).resize(48, 48).png().toFile("app/icon.png");
console.log("Symbole erzeugt.");
