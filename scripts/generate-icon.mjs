import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const svgPath = path.join(rootDir, 'public', 'bot-icon.svg');
const iconsetDir = path.join(rootDir, 'icon.iconset');

// Create iconset directory
if (!fs.existsSync(iconsetDir)) {
  fs.mkdirSync(iconsetDir, { recursive: true });
}

// macOS iconset requires specific sizes
const sizes = [
  { size: 16, name: 'icon_16x16.png' },
  { size: 32, name: 'icon_16x16@2x.png' },
  { size: 32, name: 'icon_32x32.png' },
  { size: 64, name: 'icon_32x32@2x.png' },
  { size: 128, name: 'icon_128x128.png' },
  { size: 256, name: 'icon_128x128@2x.png' },
  { size: 256, name: 'icon_256x256.png' },
  { size: 512, name: 'icon_256x256@2x.png' },
  { size: 512, name: 'icon_512x512.png' },
  { size: 1024, name: 'icon_512x512@2x.png' },
];

const svg = fs.readFileSync(svgPath);

console.log('Generating icon sizes...');

for (const { size, name } of sizes) {
  const outputPath = path.join(iconsetDir, name);
  await sharp(svg, { density: 300 })
    .resize(size, size)
    .png()
    .toFile(outputPath);
  console.log(`Generated ${name} (${size}x${size})`);
}

console.log('\nAll sizes generated. Run: iconutil -c icns icon.iconset -o public/icon.icns');
