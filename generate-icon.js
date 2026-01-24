const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function generateIcons() {
  const svgPath = path.join(__dirname, 'public', 'bot-icon.svg');
  const iconsetDir = path.join(__dirname, 'public', 'icon.iconset');
  const icnsPath = path.join(__dirname, 'public', 'icon.icns');

  // Create iconset directory
  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true });
  }

  // Icon sizes needed for macOS .icns
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

  console.log('Generating PNG files from SVG...');

  // Use sips (macOS built-in tool) to convert SVG to PNG at different sizes
  for (const { size, name } of sizes) {
    const outputPath = path.join(iconsetDir, name);
    try {
      await execAsync(
        `qlmanage -t -s ${size} -o "${iconsetDir}" "${svgPath}" && mv "${iconsetDir}/bot-icon.svg.png" "${outputPath}"`
      );
      console.log(`✓ Generated ${name}`);
    } catch (error) {
      console.log(`⚠ Trying alternative method for ${name}...`);
      // Fallback: copy SVG and let iconutil handle it
      try {
        await execAsync(
          `sips -s format png "${svgPath}" --out "${outputPath}" -z ${size} ${size}`
        );
        console.log(`✓ Generated ${name} (fallback)`);
      } catch (e) {
        console.error(`✗ Failed to generate ${name}:`, e.message);
      }
    }
  }

  console.log('\nConverting iconset to .icns...');
  try {
    await execAsync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`);
    console.log(`✓ Generated icon.icns`);

    // Clean up iconset directory
    fs.rmSync(iconsetDir, { recursive: true });
    console.log('✓ Cleaned up temporary files');

    console.log('\n✨ Icon generation complete!');
    console.log(`📁 Icon saved to: ${icnsPath}`);
  } catch (error) {
    console.error('✗ Failed to generate .icns:', error.message);
    console.log('\nThe iconset directory has been created at:');
    console.log(iconsetDir);
    console.log('\nYou can manually convert it to .icns using:');
    console.log(`iconutil -c icns "${iconsetDir}"`);
  }
}

generateIcons().catch(console.error);
