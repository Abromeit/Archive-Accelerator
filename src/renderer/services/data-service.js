export async function getSnapshots(url) {
    return await window.api.getSnapshots(url);
}


export async function getSnapshotContent(id) {
    return await window.api.getSnapshotContent(id);
}


export async function getSnapshotBotview(id) {
    return await window.api.getSnapshotBotview(id);
}


export async function getPageInfo(url) {
    return await window.api.getPageInfo(url);
}


let _syncProgressCallback = null;
let _syncLogCallback = null;

export function initSyncProgressListener() {
    if (window.api?.onSyncProgress) {
        window.api.onSyncProgress(function (data) {
            if (_syncProgressCallback) {
                _syncProgressCallback(data);
            }
        });
    }
    if (window.api?.onSyncLog) {
        window.api.onSyncLog(function (data) {
            if (_syncLogCallback) {
                _syncLogCallback(data);
            }
        });
    }
}


export async function syncUrl(url, onProgress, onLog) {
    _syncProgressCallback = onProgress;
    _syncLogCallback = onLog || null;
    try {
        return await window.api.syncUrl(url);
    } finally {
        _syncProgressCallback = null;
        _syncLogCallback = null;
    }
}


export async function getSyncLogs(url) {
    return await window.api.getSyncLogs(url);
}


export async function getAnalyticsData(url) {
    return await window.api.getAnalyticsData(url);
}


export async function syncAnalytics(url) {
    return await window.api.syncAnalytics(url);
}


export function getConnectedProviders() {
    return window.api.getProviders();
}


export async function connectProvider(id) {
    return await window.api.connectProvider(id);
}


export async function disconnectProvider(id) {
    return await window.api.disconnectProvider(id);
}


export async function getChartPreferences() {
    return await window.api.getChartPreferences();
}


export async function setChartPreferences(prefs) {
    return await window.api.setChartPreferences(prefs);
}
