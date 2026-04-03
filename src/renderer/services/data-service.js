import * as mock from './mock-data.js';

const PREFS_KEY = 'archive-accelerator-chart-prefs';
let providerState = structuredClone(mock.providers);


export async function getSnapshots(url) {
    if (url === mock.MOCK_URL) {
        return structuredClone(mock.snapshots).reverse();
    }
    return [];
}


export async function getSnapshotContent(id) {
    const snap = mock.snapshots.find((s) => s.id === id);
    return snap ? structuredClone(snap) : null;
}


export async function getPageInfo(url) {
    if (url === mock.MOCK_URL) {
        return structuredClone(mock.pageInfo);
    }
    return null;
}


export async function syncUrl(url, onProgress) {
    const total = 47;
    let current = 0;

    return new Promise((resolve) => {
        const interval = setInterval(() => {
            current += Math.ceil(Math.random() * 5);
            if (current >= total) {
                current = total;
                clearInterval(interval);
                onProgress({ current, total, done: true });
                resolve({ current, total });
                return;
            }
            onProgress({ current, total, done: false });
        }, 300);
    });
}


export async function getAnalyticsData(url) {
    if (url === mock.MOCK_URL) {
        return structuredClone(mock.analyticsData);
    }
    return [];
}


export function getConnectedProviders() {
    return structuredClone(providerState);
}


export async function connectProvider(id) {
    const provider = providerState.find((p) => p.id === id);
    if (provider) {
        provider.connected = true;
    }
    return getConnectedProviders();
}


export async function disconnectProvider(id) {
    const provider = providerState.find((p) => p.id === id);
    if (provider) {
        provider.connected = false;
    }
    return getConnectedProviders();
}


export function getChartPreferences() {
    try {
        const stored = localStorage.getItem(PREFS_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch {
        // ignore
    }
    return { clicks: true, impressions: true, position: false };
}


export function setChartPreferences(prefs) {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
