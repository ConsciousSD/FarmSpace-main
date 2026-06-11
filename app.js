const { app, BrowserWindow } = require('electron');

function createWindow() {
  // Configures the desktop window frame for Farm Space
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    useContentSize: true, // Forces the window canvas to map your aspect ratio precisely
    resizable: true,
    backgroundColor: '#000000', // Clean black background while loading textures
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Automatically opens the Developer Tools frame for console debugging while coding
  win.webContents.openDevTools();

  // Loads your game's HTML frontend layout
  win.loadFile('www/index.html');
}

// Bootstraps Electron to launch the window container once initialization is stable
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Shuts down the engine cleanly when the app window is closed by the player
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});