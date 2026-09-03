const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const log = require('electron-log');

const isDev = !app.isPackaged;

log.transports.file.level = 'info';
log.info('App starting. Version:', app.getVersion());

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    autoHideMenuBar: true
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  return win;
}

function setupAutoUpdater(win) {
  const { autoUpdater } = require('electron-updater');
  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => log.info('Checking for update...'));
  autoUpdater.on('update-available', (info) => log.info('Update available:', info.version));
  autoUpdater.on('update-not-available', (info) => log.info('No update available. Current:', info.version));
  autoUpdater.on('download-progress', (p) => log.info(`Download progress: ${Math.round(p.percent)}%`));

  autoUpdater.on('update-downloaded', () => {
    log.info('Update downloaded, will install on quit.');
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Update Ready',
      message: 'A new version has been downloaded. It will be installed the next time you close the app.',
      buttons: ['OK']
    });
  });

  autoUpdater.on('error', (err) => {
    log.error('Auto-update error:', err == null ? 'unknown' : (err.stack || err));
  });

  autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(() => {
  const win = createWindow();
  if (!isDev) setupAutoUpdater(win);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});