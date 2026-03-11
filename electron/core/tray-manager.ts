import { Tray, nativeImage, NativeImage } from 'electron';
import * as path from 'path';
import { toggleTrayPanel, destroyTrayPanel } from './tray-panel-manager';
import { setTrayAttentionCallback } from '../utils/agents-tick';

let tray: Tray | null = null;
let normalIcon: NativeImage | null = null;
let badgeIcon: NativeImage | null = null;
let showingBadge = false;

function resolveIconPath(): string {
  // __dirname is electron/dist/core/ at runtime, resources are at electron/resources/
  // Use the full-color Dorothy logo instead of a monochrome template
  let iconPath = path.join(__dirname, '..', '..', 'resources', 'trayColor.png');
  // In production, resources are unpacked outside the asar archive
  iconPath = iconPath.replace('app.asar', 'app.asar.unpacked');
  return iconPath;
}

function createBadgeIcon(base: NativeImage): NativeImage {
  let icon2xPath = path.join(__dirname, '..', '..', 'resources', 'trayColor@2x.png');
  icon2xPath = icon2xPath.replace('app.asar', 'app.asar.unpacked');
  const icon2x = nativeImage.createFromPath(icon2xPath);

  // Make the 2x icon circular first
  const circular = makeCircular(icon2x, 2.0);

  // Derive physical pixel dimensions from the bitmap buffer
  const bitmap = circular.toBitmap();
  const logicalSize = circular.getSize();
  const totalPx = bitmap.length / 4;
  const w = Math.round(Math.sqrt(totalPx * (logicalSize.width / logicalSize.height)));
  const h = totalPx / w;

  const dotR = Math.max(3, Math.round(w * 0.15));
  const dotCx = w - dotR - 1;
  const dotCy = dotR + 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - dotCx;
      const dy = y - dotCy;
      if (dx * dx + dy * dy <= dotR * dotR) {
        const i = (y * w + x) * 4;
        bitmap[i] = 239;     // R (#ef4444)
        bitmap[i + 1] = 68;  // G
        bitmap[i + 2] = 68;  // B
        bitmap[i + 3] = 255; // A
      }
    }
  }

  return nativeImage.createFromBitmap(bitmap, { width: w, height: h, scaleFactor: 2.0 });
}

function makeCircular(img: NativeImage, scale: number): NativeImage {
  // toBitmap() returns physical pixels, getSize() returns logical size.
  // Derive actual pixel dimensions from the buffer to avoid size mismatch.
  const bitmap = img.toBitmap();
  const totalPixels = bitmap.length / 4;
  const logicalSize = img.getSize();
  // Physical dimensions: logical × scale (or derive from buffer if square)
  const w = Math.round(Math.sqrt(totalPixels * (logicalSize.width / logicalSize.height)));
  const h = totalPixels / w;

  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r * r) {
        bitmap[(y * w + x) * 4 + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBitmap(bitmap, { width: w, height: h, scaleFactor: scale });
}

export function initTray() {
  // Use the @2x image with scaleFactor 2.0 so macOS gets full-resolution
  // pixels on retina displays instead of upscaling the tiny 1x image.
  let icon2xPath = path.join(__dirname, '..', '..', 'resources', 'trayColor@2x.png');
  icon2xPath = icon2xPath.replace('app.asar', 'app.asar.unpacked');
  const rawIcon = nativeImage.createFromPath(icon2xPath);
  const icon = makeCircular(rawIcon, 2.0);
  icon.setTemplateImage(false);
  normalIcon = icon;

  tray = new Tray(icon);
  tray.setToolTip('Dorothy');

  tray.on('click', () => {
    if (tray) {
      toggleTrayPanel(tray.getBounds());
    }
  });

  // Register the attention callback so agents-tick can drive badge updates
  setTrayAttentionCallback(updateTrayAttention);
}

export function updateTrayAttention(hasWaiting: boolean): void {
  if (!tray || !normalIcon) return;

  if (hasWaiting && !showingBadge) {
    if (!badgeIcon) {
      badgeIcon = createBadgeIcon(normalIcon);
    }
    // When showing badge, don't use template image so the red dot is visible
    badgeIcon.setTemplateImage(false);
    tray.setImage(badgeIcon);
    showingBadge = true;
  } else if (!hasWaiting && showingBadge) {
    tray.setImage(normalIcon);
    showingBadge = false;
  }
}

export function rebuildTrayMenu() {
  // No-op: the tray panel is live via IPC, no native menu to rebuild
}

export function destroyTray() {
  destroyTrayPanel();
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
