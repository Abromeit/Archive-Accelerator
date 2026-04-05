import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
    getAppVersion: function () {
        return ipcRenderer.invoke('get-app-version');
    },

    getAllUrls: function () {
        return ipcRenderer.invoke('get-all-urls');
    },

    getSnapshots: function (url) {
        return ipcRenderer.invoke('get-snapshots', url);
    },

    getSnapshotContent: function (id) {
        return ipcRenderer.invoke('get-snapshot-content', id);
    },

    getSnapshotBotview: function (id) {
        return ipcRenderer.invoke('get-snapshot-botview', id);
    },

    getPageInfo: function (url) {
        return ipcRenderer.invoke('get-page-info', url);
    },

    syncUrl: function (url) {
        return ipcRenderer.invoke('sync-url', url);
    },

    onSyncProgress: function (callback) {
        ipcRenderer.on('sync-progress', function (_event, data) {
            callback(data);
        });
    },

    getAnalyticsData: function (url) {
        return ipcRenderer.invoke('get-analytics-data', url);
    },

    syncAnalytics: function (url) {
        return ipcRenderer.invoke('sync-analytics', url);
    },

    getProviders: function () {
        return ipcRenderer.invoke('get-providers');
    },

    connectProvider: function (id) {
        return ipcRenderer.invoke('connect-provider', id);
    },

    disconnectProvider: function (id) {
        return ipcRenderer.invoke('disconnect-provider', id);
    },

    getChartPreferences: function () {
        return ipcRenderer.invoke('get-chart-preferences');
    },

    setChartPreferences: function (prefs) {
        return ipcRenderer.invoke('set-chart-preferences', prefs);
    },

    getSnapshotDiffs: function (snapshotA, snapshotB) {
        return ipcRenderer.invoke('get-snapshot-diffs', snapshotA, snapshotB);
    },

    deleteSnapshotsForUrl: function (url) {
        return ipcRenderer.invoke('delete-snapshots-for-url', url);
    },

    confirmDeleteSnapshots: function (url, count) {
        return ipcRenderer.invoke('confirm-delete-snapshots', url, count);
    },

    openExternal: function (url) {
        return ipcRenderer.invoke('open-external', url);
    },

});
