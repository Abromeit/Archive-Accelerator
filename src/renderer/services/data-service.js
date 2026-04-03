export async function getSnapshots(url) {
    return await window.api.getSnapshots(url);
}


export async function getSnapshotContent(id) {
    return await window.api.getSnapshotContent(id);
}


export async function getPageInfo(url) {
    return await window.api.getPageInfo(url);
}


let _syncProgressCallback = null;

export function initSyncProgressListener() {
    if (window.api?.onSyncProgress) {
        window.api.onSyncProgress(function (data) {
            if (_syncProgressCallback) {
                _syncProgressCallback(data);
            }
        });
    }
}


export async function syncUrl(url, onProgress) {
    _syncProgressCallback = onProgress;
    try {
        return await window.api.syncUrl(url);
    } finally {
        _syncProgressCallback = null;
    }
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
