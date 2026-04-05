import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { join } from 'node:path';
import { config } from 'dotenv';
import { buildMenu } from './menu.js';
import { initDb, getSnapshotsWithDiffs, getSnapshotHtml, getSnapshotBotview, getPageInfo, getAllUrls, getAnalyticsData, getAllProviders, disconnectProvider, getSetting, setSetting, deleteSnapshotsForUrl } from './db.js';
import { decompressToString } from './compression.js';
import { syncUrl } from './archive-sync.js';
import { syncAnalytics } from './gsc-api.js';
import { startOAuthFlow, loadCredentials } from './gsc-auth.js';
import { computeAllDiffs } from './diff-engine.js';

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

    buildMenu();

    if (isDev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
}


app.whenReady().then(function () {
    config();
    initDb();
    loadCredentials();

    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});


app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});


ipcMain.handle('get-app-version', function () {
    return app.getVersion();
});


ipcMain.handle('open-external', function (_event, url) {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        shell.openExternal(url);
    }
});


ipcMain.handle('get-all-urls', function () {
    return getAllUrls();
});


ipcMain.handle('get-snapshots', function (_event, url) {
    const rows = getSnapshotsWithDiffs(url);
    return rows.map(function (row) {
        const templatePct = row.template_pct ?? 0;
        const textPct = row.text_pct ?? 0;
        const metaPct = row.meta_pct ?? 0;

        return {
            id: row.id,
            url: row.url,
            date: row.date,
            source: row.source,
            plaintext: row.plaintext,
            title: row.title,
            metaDescription: row.meta_description,
            percentage: Math.round(((templatePct + textPct + metaPct) / 3) * 10) / 10,
            templatePct,
            textPct,
            metaPct,
            templateChanged: templatePct > 0,
            textChanged: textPct > 0,
            headlinesChanged: Boolean(row.headlines_changed),
            metaChanged: metaPct > 0,
            titleChanged: Boolean(row.title_changed),
        };
    });
});


ipcMain.handle('get-snapshot-content', function (_event, id) {
    const compressed = getSnapshotHtml(id);
    if (!compressed) return null;
    return decompressToString(compressed);
});


ipcMain.handle('get-snapshot-botview', function (_event, id) {
    return getSnapshotBotview(id);
});


ipcMain.handle('get-page-info', function (_event, url) {
    return getPageInfo(url);
});


ipcMain.handle('sync-url', async function (_event, url) {
    await syncUrl(url, function (progress) {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('sync-progress', progress);
        }
    });
    return { success: true };
});


ipcMain.handle('get-analytics-data', function (_event, url) {
    return getAnalyticsData(url, 'gsc');
});


ipcMain.handle('sync-analytics', async function (_event, url) {
    return await syncAnalytics(url);
});


ipcMain.handle('get-providers', function () {
    const providers = getAllProviders();
    if (providers.length === 0) {
        return [{
            id: 'gsc',
            name: 'Google Search Console',
            connected: false,
            property: null,
        }];
    }
    return providers.map(function (p) {
        return { ...p, connected: Boolean(p.connected) };
    });
});


ipcMain.handle('connect-provider', async function (_event, providerId) {
    if (providerId === 'gsc') {
        const result = await startOAuthFlow();
        return result;
    }
    throw new Error(`Unknown provider: ${providerId}`);
});


ipcMain.handle('disconnect-provider', function (_event, providerId) {
    disconnectProvider(providerId);
    return { success: true };
});


ipcMain.handle('get-chart-preferences', function () {
    const stored = getSetting('chart-preferences');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch {
            // ignore
        }
    }
    return { clicks: true, impressions: true, position: false, granularity: 'daily' };
});


ipcMain.handle('set-chart-preferences', function (_event, prefs) {
    setSetting('chart-preferences', JSON.stringify(prefs));
    return { success: true };
});


ipcMain.handle('get-snapshot-diffs', function (_event, snapshotA, snapshotB) {
    return computeAllDiffs(snapshotA, snapshotB);
});


ipcMain.handle('confirm-delete-snapshots', async function (_event, url, count) {
    const result = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['Cancel', 'Delete'],
        defaultId: 0,
        cancelId: 0,
        title: 'Delete Snapshots',
        message: `Delete all ${count} snapshots for this URL?`,
        detail: url,
    });
    return result.response === 1;
});


ipcMain.handle('delete-snapshots-for-url', function (_event, url) {
    deleteSnapshotsForUrl(url);
    return { success: true };
});
