// main.js
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const chokidar = require('chokidar');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const cron = require('node-cron');
const { computeFileHash } = require('./hashUtils');

const store = require('./config');
const registerAgent = require('./registerAgent');
const { insertEvent, getAllEvents } = require('./database');

let mainWindow;

// --- Helper: log messages to UI ---
function logToUI(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
  const formatted = `[${timestamp}] ${message}`;
  console.log(formatted);
  if (mainWindow) mainWindow.webContents.send('log', formatted);
}

// --- File watcher ---
function initWatcher() {
  const watchPaths = store.get('watchPaths');
  const watcher = chokidar.watch(watchPaths, { persistent: true, ignoreInitial: false });

  const sendAlertToServer = async (eventType, filePath) => {
  const agentId = store.get('agentId');
  if (!agentId) {
    logToUI('⚠️ Agent ID not set. Cannot send alert.');
    return;
  }

  try {
    let oldHash = null;
    let newHash = null;

    // Only compute hash for existing files
    if (eventType === 'ADDED' || eventType === 'CHANGED') {
      newHash = await computeFileHash(filePath);
    }

    const alertPayload = {
      agentId,
      filePath,
      changeType: eventType.toLowerCase(),
      oldHash,
      newHash
    };

    const serverUrl = store.get('alertUrl');
    await axios.post(serverUrl, alertPayload);

    logToUI(`☁️ Alert sent (${eventType}): ${filePath}`);
    if (newHash) logToUI(`🔐 Hash: ${newHash.slice(0, 16)}...`);
  } catch (err) {
    logToUI(`⚠️ Failed to send alert: ${err.response?.data?.error || err.message}`);
  }
};


  const handleEvent = (eventType, filePath) => {
    insertEvent(filePath, eventType.toLowerCase());
    logToUI(`${eventType} - ${filePath}`);
    sendAlertToServer(eventType, filePath);
  };

  watcher
    .on('add', path => handleEvent('ADDED', path))
    .on('change', path => handleEvent('CHANGED', path))
    .on('unlink', path => handleEvent('REMOVED', path))
    .on('error', err => logToUI(`⚠️ Watcher error: ${err.message}`));

  // Optional: periodic log
  cron.schedule(`*/${store.get('scanIntervalMinutes')} * * * *`, () => {
    logToUI('⏰ Periodic scan completed');
  });

  logToUI(`👀 Watching paths: ${watchPaths.join(', ')}`);
}

// --- IPC Handlers ---
ipcMain.handle('get-events', async () => {
  return new Promise(resolve => getAllEvents(rows => resolve(rows)));
});

ipcMain.handle('upload-file', async (event, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return { error: 'Invalid file path' };

  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));

    const serverUrl = store.get('uploadUrl');
    const response = await axios.post(serverUrl, formData, {
      headers: formData.getHeaders()
    });

    return { message: `✅ ${response.data.message}` };
  } catch (err) {
    return { error: 'Upload failed: ' + err.message };
  }
});

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('get-agent-id', async () => {
  return store.get('agentId') || 'Not registered';
});

// --- App lifecycle ---
async function startApp() {
  // 1️⃣ Register the agent first
  const agentId = await registerAgent();
  if (!agentId) {
    console.error('❌ Agent registration failed. Exiting.');
    app.quit();
    return;
  }

  // 2️⃣ Create the main window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 600,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // 3️⃣ Start the watcher **after registration**
  initWatcher();

  // 4️⃣ Send agent ID to renderer
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('agent-registered', agentId);
  });
}

app.whenReady().then(startApp);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
