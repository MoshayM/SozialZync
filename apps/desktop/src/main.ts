import { app, BrowserWindow, shell, Tray, Menu, nativeImage, dialog, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import os from 'os';

const APP_URL = 'https://sozialzynk.vercel.app';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// ── Single-instance lock ──────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow(): void {
  const iconPath = path.join(__dirname, '../assets/icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    title: 'Sozialzynk',
    icon: iconPath,
    backgroundColor: '#111827',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow the web app to use all its features
      webSecurity: true,
    },
  });

  mainWindow.loadURL(APP_URL);

  // Show window only after content has painted — avoids white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow!.show();
    if (process.platform === 'win32') {
      mainWindow!.setThumbarButtons([]);
    }
  });

  // Open links that leave the app domain in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL)) return { action: 'allow' };
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_URL) && !url.startsWith('devtools://')) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray(): void {
  const iconPath = path.join(__dirname, '../assets/icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Sozialzynk',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => { autoUpdater.checkForUpdates(); },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit(); } },
  ]);

  tray.setToolTip('Sozialzynk — AI Content Creator Platform');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show();
    } else {
      createWindow();
    }
  });
}

// ── Auto-updater ──────────────────────────────────────────────────────────────
function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    mainWindow?.webContents.send('update-available');
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'A new version of Sozialzynk has been downloaded. Restart the app to apply the update.',
      buttons: ['Restart Now', 'Later'],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
  });

  // Check 5s after launch, then every 4 hours
  setTimeout(() => { autoUpdater.checkForUpdatesAndNotify(); }, 5_000);
  setInterval(() => { autoUpdater.checkForUpdatesAndNotify(); }, 4 * 60 * 60 * 1000);
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.handle('app-version', () => app.getVersion());
ipcMain.handle('platform', () => os.platform());
ipcMain.on('check-for-updates', () => { autoUpdater.checkForUpdates(); });

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // On macOS keep the app running in the tray; on Windows/Linux quit.
  if (process.platform !== 'darwin') {
    // Keep tray alive — only quit via tray menu or taskbar
  }
});

app.on('before-quit', () => {
  tray?.destroy();
});
