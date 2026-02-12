import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const sourcePath = path.join(rootDir, 'public', 'dorothy-without-text.png');
const iconsetDir = path.join(rootDir, 'icon.iconset');
const icnsPath = path.join(rootDir, 'public', 'icon.icns');

// Create iconset directory
if (fs.existsSync(iconsetDir)) {
  fs.rmSync(iconsetDir, { recursive: true });
}
fs.mkdirSync(iconsetDir, { recursive: true });

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

console.log('Generating macOS icon from dorothy-without-text.png...');

// First, create a 1024x1024 version with the background color filling the entire canvas
// Sample the dominant background color from the image (the green/teal swirl)
// We flatten onto a matching background so there are no transparent pixels
const baseImage = await sharp(sourcePath)
  .flatten({ background: { r: 106, g: 148, b: 120 } }) // match the green background
  .resize(1024, 1024, { fit: 'cover' })
  .png()
  .toBuffer();

for (const { size, name } of sizes) {
  const outputPath = path.join(iconsetDir, name);
  await sharp(baseImage)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toFile(outputPath);
  console.log(`Generated ${name} (${size}x${size})`);
}

// Convert iconset to .icns using macOS iconutil
console.log('\nConverting iconset to .icns...');
try {
  execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`);
  console.log(`Generated ${icnsPath}`);

  // Clean up
  fs.rmSync(iconsetDir, { recursive: true });
  console.log('Cleaned up iconset directory');
  console.log('\nDone! Icon saved to public/icon.icns');
} catch (err) {
  console.error('Failed to convert iconset:', err.message);
  console.log(`Iconset directory left at: ${iconsetDir}`);
  console.log('Run manually: iconutil -c icns icon.iconset -o public/icon.icns');
}
