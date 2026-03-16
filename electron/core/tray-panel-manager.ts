import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

let trayPanel: BrowserWindow | null = null;

const PANEL_WIDTH = 800;
const PANEL_HEIGHT = 540;

export function createTrayPanel(): BrowserWindow {
  if (trayPanel && !trayPanel.isDestroyed()) {
    return trayPanel;
  }

  trayPanel = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#F0E8D5',
    hasShadow: true,
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    trayPanel.loadURL('http://localhost:3000/tray-panel');
  } else {
    trayPanel.loadURL('app://-/tray-panel/index.html');
  }

  trayPanel.on('blur', () => {
    hideTrayPanel();
  });

  trayPanel.on('closed', () => {
    trayPanel = null;
  });

  return trayPanel;
}

export function toggleTrayPanel(trayBounds: Electron.Rectangle): void {
  if (trayPanel && !trayPanel.isDestroyed() && trayPanel.isVisible()) {
    hideTrayPanel();
    return;
  }

  if (!trayPanel || trayPanel.isDestroyed()) {
    createTrayPanel();
  }

  // Position below the tray icon, centered horizontally
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x,
    y: trayBounds.y,
  });

  const x = Math.round(trayBounds.x + trayBounds.width / 2 - PANEL_WIDTH / 2);
  const y = trayBounds.y + trayBounds.height + 4;

  // Clamp to screen bounds
  const clampedX = Math.max(
    display.workArea.x,
    Math.min(x, display.workArea.x + display.workArea.width - PANEL_WIDTH)
  );

  trayPanel!.setPosition(clampedX, y);
  trayPanel!.show();
}

export function hideTrayPanel(): void {
  if (trayPanel && !trayPanel.isDestroyed()) {
    trayPanel.hide();
  }
}

export function destroyTrayPanel(): void {
  if (trayPanel && !trayPanel.isDestroyed()) {
    trayPanel.destroy();
    trayPanel = null;
  }
}
