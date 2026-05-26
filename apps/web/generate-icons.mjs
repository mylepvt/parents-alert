import sharp from "sharp";
import { mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "public", "icons");
mkdirSync(outDir, { recursive: true });

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

function busIconSvg(size) {
  const pad = size * 0.1;
  const s = size - pad * 2;
  const r = size * 0.18; // border radius of background

  // Scale factor: design at 512, scale down
  const sc = s / 400;
  const tx = pad;
  const ty = pad;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#09090B"/>
  <g transform="translate(${tx}, ${ty}) scale(${sc})">
    <!-- Bus body -->
    <rect x="30" y="80" width="340" height="230" rx="28" fill="#16A34A"/>
    <!-- Windshield -->
    <rect x="55" y="100" width="135" height="90" rx="10" fill="#BBF7D0" opacity="0.9"/>
    <!-- Windows right side -->
    <rect x="215" y="100" width="80" height="90" rx="10" fill="#BBF7D0" opacity="0.9"/>
    <rect x="310" y="100" width="55" height="90" rx="10" fill="#BBF7D0" opacity="0.9"/>
    <!-- Door -->
    <rect x="130" y="200" width="70" height="100" rx="6" fill="#15803D"/>
    <rect x="200" y="200" width="70" height="100" rx="6" fill="#15803D"/>
    <!-- Door handle -->
    <circle cx="200" cy="252" r="7" fill="#4ADE80"/>
    <!-- Front stripe -->
    <rect x="30" y="200" width="340" height="14" fill="#4ADE80" opacity="0.5"/>
    <!-- Bumpers -->
    <rect x="20" y="290" width="360" height="24" rx="12" fill="#15803D"/>
    <!-- Wheels -->
    <circle cx="100" cy="320" r="42" fill="#1C1C1E"/>
    <circle cx="100" cy="320" r="26" fill="#27272A"/>
    <circle cx="100" cy="320" r="10" fill="#4ADE80"/>
    <circle cx="300" cy="320" r="42" fill="#1C1C1E"/>
    <circle cx="300" cy="320" r="26" fill="#27272A"/>
    <circle cx="300" cy="320" r="10" fill="#4ADE80"/>
    <!-- Headlights -->
    <rect x="32" y="240" width="40" height="22" rx="8" fill="#FDE68A"/>
    <rect x="328" y="240" width="40" height="22" rx="8" fill="#FDE68A"/>
    <!-- Roof detail -->
    <rect x="30" y="68" width="340" height="18" rx="9" fill="#15803D"/>
  </g>
</svg>`;
}

for (const size of sizes) {
  const svg = Buffer.from(busIconSvg(size));
  const outPath = join(outDir, `icon-${size}x${size}.png`);
  await sharp(svg).png().toFile(outPath);
  console.log(`✓ ${size}x${size}`);
}

console.log("All icons generated in public/icons/");
