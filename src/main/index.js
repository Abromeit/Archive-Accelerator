import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { buildMenu } from './menu.js';

let mainWindow = null;

function createWindow() {
    const isDev = !app.isPackaged;

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 600,
        backgroundColor: '#0f0f0f',
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 16, y: 18 },
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
        },
    });

    buildMenu(mainWindow);

    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
}


app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});


ipcMain.handle('get-app-version', () => app.getVersion());
