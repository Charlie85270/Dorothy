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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.pluginPtyProcesses = exports.skillPtyProcesses = exports.quickPtyProcesses = exports.ptyProcesses = void 0;
exports.killPty = killPty;
exports.writeToPty = writeToPty;
exports.resizePty = resizePty;
exports.createQuickPty = createQuickPty;
const pty = __importStar(require("node-pty"));
const uuid_1 = require("uuid");
const os = __importStar(require("os"));
exports.ptyProcesses = new Map();
exports.quickPtyProcesses = new Map();
exports.skillPtyProcesses = new Map();
exports.pluginPtyProcesses = new Map();
function killPty(ptyId, isQuick = false) {
    const processes = isQuick ? exports.quickPtyProcesses : exports.ptyProcesses;
    const ptyProcess = processes.get(ptyId);
    if (ptyProcess) {
        ptyProcess.kill();
        processes.delete(ptyId);
        return true;
    }
    return false;
}
function writeToPty(ptyId, data, isQuick = false) {
    const processes = isQuick ? exports.quickPtyProcesses : exports.ptyProcesses;
    const ptyProcess = processes.get(ptyId);
    if (ptyProcess) {
        ptyProcess.write(data);
        return true;
    }
    return false;
}
function resizePty(ptyId, cols, rows, isQuick = false) {
    const processes = isQuick ? exports.quickPtyProcesses : exports.ptyProcesses;
    const ptyProcess = processes.get(ptyId);
    if (ptyProcess) {
        ptyProcess.resize(cols, rows);
        return true;
    }
    return false;
}
function createQuickPty(cwd, cols, rows, mainWindow) {
    const shell = process.env.SHELL || '/bin/zsh';
    const ptyProcess = pty.spawn(shell, ['-l'], {
        name: 'xterm-256color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: cwd || os.homedir(),
        env: process.env,
    });
    const id = (0, uuid_1.v4)();
    exports.quickPtyProcesses.set(id, ptyProcess);
    ptyProcess.onData((data) => {
        mainWindow?.webContents.send('shell:ptyOutput', { ptyId: id, data });
    });
    ptyProcess.onExit(({ exitCode }) => {
        mainWindow?.webContents.send('shell:ptyExit', { ptyId: id, exitCode });
        exports.quickPtyProcesses.delete(id);
    });
    return id;
}
//# sourceMappingURL=pty-manager.js.map