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
exports.SLACK_CHARACTER_FACES = exports.TG_CHARACTER_FACES = exports.CLAUDE_PATTERNS = exports.MIME_TYPES = exports.APP_SETTINGS_FILE = exports.AGENTS_FILE = exports.DATA_DIR = exports.API_PORT = void 0;
const path = __importStar(require("path"));
const os = __importStar(require("os"));
exports.API_PORT = 31415;
exports.DATA_DIR = path.join(os.homedir(), '.claude-manager');
exports.AGENTS_FILE = path.join(exports.DATA_DIR, 'agents.json');
exports.APP_SETTINGS_FILE = path.join(exports.DATA_DIR, 'app-settings.json');
exports.MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
};
exports.CLAUDE_PATTERNS = {
    waitingForInput: [
        /❯\s*$/m,
        /❯$/m,
        /^❯\s*$/m,
        /\n❯\s*$/,
        /●.*\n\s*❯/,
        /^\s*❯\s/m,
        /Esc to cancel/i,
        /Tab to add additional/i,
        /shift\+Tab/i,
        /shift-Tab/i,
        /Enter to confirm/i,
        /Press Enter/i,
        /❯\s*\d/,
        />\s*\d+\.\s/,
        /\(Use arrow keys\)/i,
        /Use arrow keys/i,
        /\[Y\/n\]/i,
        /\[y\/N\]/i,
        /\(y\/n\)/i,
        /\[yes\/no\]/i,
        /\d+\.\s*Yes\b/i,
        /\d+\.\s*No\b/i,
        /\d+\.\s*Cancel\b/i,
        /\d+\.\s*Skip\b/i,
        /Do you want to create/i,
        /Do you want to edit/i,
        /Do you want to delete/i,
        /Do you want to write/i,
        /Do you want to read/i,
        /Do you want to run/i,
        /Do you want to execute/i,
        /Do you want to allow/i,
        /Do you want to proceed/i,
        /Do you want to continue/i,
        /Do you want to overwrite/i,
        /Do you want to replace/i,
        /Do you want to install/i,
        /Do you want to update/i,
        /Do you want to remove/i,
        /Do you want to/i,
        /Allow this/i,
        /Allow .+ to/i,
        /Approve this/i,
        /Confirm this/i,
        /Accept this/i,
        /Let me know what/i,
        /let me know if/i,
        /What would you like/i,
        /What should I/i,
        /How would you like/i,
        /How can I help/i,
        /What do you think/i,
        /Which .+ would you/i,
        /Which .+ should/i,
        /Would you like to/i,
        /Would you like me to/i,
        /Should I\s/i,
        /Can I\s/i,
        /May I\s/i,
        /Shall I\s/i,
        /What else/i,
        /Anything else/i,
        /Is there anything/i,
        /Enter your/i,
        /Enter a /i,
        /Type your/i,
        /Input:/i,
        /Provide /i,
        /Specify /i,
        /Choose /i,
        /Select /i,
        /Pick /i,
        /waiting for/i,
        /ready for/i,
        /awaiting/i,
        /\$\s*$/m,
        />\s*$/m,
    ],
    working: [
        /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,
        /◐|◓|◑|◒/,
        /⣾|⣽|⣻|⢿|⡿|⣟|⣯|⣷/,
        /Thinking\.\.\./i,
        /Working\.\.\./i,
        /Analyzing\.\.\./i,
        /Processing\.\.\./i,
        /Generating\.\.\./i,
        /Loading\.\.\./i,
        /Fetching\.\.\./i,
        /Compiling\.\.\./i,
        /Building\.\.\./i,
        /Reading .+\.\.\./i,
        /Writing .+\.\.\./i,
        /Searching .+\.\.\./i,
        /Running .+\.\.\./i,
        /Executing .+\.\.\./i,
        /Installing .+\.\.\./i,
        /Updating .+\.\.\./i,
        /Creating .+\.\.\./i,
        /Downloading .+\.\.\./i,
        /Uploading .+\.\.\./i,
    ],
    completed: [
        /Task completed/i,
        /Done!/i,
        /Finished!/i,
        /Complete!/i,
        /Successfully/i,
        /✓/,
        /✔/,
        /\[done\]/i,
        /Worked for \d+/i,
        /\* Worked for/i,
    ],
    error: [
        /Error:/i,
        /Failed:/i,
        /Exception:/i,
        /FATAL/i,
        /✗/,
        /✘/,
        /\[error\]/i,
        /Permission denied/i,
        /not found/i,
    ],
};
exports.TG_CHARACTER_FACES = {
    robot: '🤖',
    ninja: '🥷',
    wizard: '🧙',
    astronaut: '👨‍🚀',
    knight: '⚔️',
    pirate: '🏴‍☠️',
    alien: '👽',
    viking: '🪓',
    frog: '🐸',
};
exports.SLACK_CHARACTER_FACES = {
    'robot': ':robot_face:',
    'ninja': ':ninja:',
    'wizard': ':mage:',
    'astronaut': ':astronaut:',
    'knight': ':crossed_swords:',
    'pirate': ':pirate_flag:',
    'alien': ':alien:',
    'viking': ':axe:',
};
//# sourceMappingURL=index.js.map