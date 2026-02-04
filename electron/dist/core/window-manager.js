"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupProtocolHandler = exports.registerProtocolSchemes = exports.createWindow = exports.setMainWindow = exports.getMainWindow = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const utils_1 = require("../utils");
const constants_1 = require("../constants");
// Global reference to the main window
let mainWindow = null;
/**
 * Get the main window instance
 */
function getMainWindow() {
    return mainWindow;
}
exports.getMainWindow = getMainWindow;
/**
 * Set the main window instance
 */
function setMainWindow(window) {
    mainWindow = window;
}
exports.setMainWindow = setMainWindow;
/**
 * Create the main application window
 */
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1600,
        height: 1000,
        minWidth: 1200,
        minHeight: 800,
        title: 'claude.mgr',
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#0a0a0f',
        webPreferences: {
            preload: path.join(__dirname, '..', 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    // Load the Next.js app
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    }
    else {
        // In production, use the custom app:// protocol to properly serve static files
        // This fixes issues with absolute paths like /logo.png not resolving correctly
        mainWindow.loadURL('app://-/index.html');
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    // Handle loading errors
    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
        console.error('Failed to load:', validatedURL, errorCode, errorDescription);
    });
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('Page loaded successfully');
    });
}
exports.createWindow = createWindow;
/**
 * Register custom protocol for serving static files
 * This must be called before app.whenReady()
 */
function registerProtocolSchemes() {
    electron_1.protocol.registerSchemesAsPrivileged([
        {
            scheme: 'app',
            privileges: {
                standard: true,
                secure: true,
                supportFetchAPI: true,
                corsEnabled: true,
            },
        },
    ]);
}
exports.registerProtocolSchemes = registerProtocolSchemes;
/**
 * Setup the custom app:// protocol handler for serving static files
 * This should be called after app.whenReady() and before loading the window
 */
function setupProtocolHandler() {
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) {
        const basePath = (0, utils_1.getAppBasePath)();
        console.log('Registering app:// protocol with basePath:', basePath);
        electron_1.protocol.handle('app', (request) => {
            let urlPath = request.url.replace('app://', '');
            // Remove the host part (e.g., "localhost" or "-")
            const slashIndex = urlPath.indexOf('/');
            if (slashIndex !== -1) {
                urlPath = urlPath.substring(slashIndex);
            }
            else {
                urlPath = '/';
            }
            // Default to index.html for directory requests
            if (urlPath === '/' || urlPath === '') {
                urlPath = '/index.html';
            }
            // Handle page routes (e.g., /agents/, /settings/) - serve their index.html
            if (urlPath.endsWith('/')) {
                urlPath = urlPath + 'index.html';
            }
            // Remove leading slash for path.join
            const relativePath = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;
            const filePath = path.join(basePath, relativePath);
            console.log(`app:// request: ${request.url} -> ${filePath}`);
            // Check if file exists
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const ext = path.extname(filePath).toLowerCase();
                const mimeType = constants_1.MIME_TYPES[ext] || 'application/octet-stream';
                return new Response(fs.readFileSync(filePath), {
                    headers: { 'Content-Type': mimeType },
                });
            }
            // If it's a page route without .html, try adding index.html
            const htmlPath = path.join(basePath, relativePath, 'index.html');
            if (fs.existsSync(htmlPath)) {
                return new Response(fs.readFileSync(htmlPath), {
                    headers: { 'Content-Type': 'text/html' },
                });
            }
            console.error(`File not found: ${filePath}`);
            return new Response('Not Found', { status: 404 });
        });
    }
}
exports.setupProtocolHandler = setupProtocolHandler;
//# sourceMappingURL=window-manager.js.map