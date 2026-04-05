import { compress } from './compression.js';
import { parseSnapshot } from './content-parser.js';
import { computeAllDiffs } from './diff-engine.js';
import {
    insertSnapshot,
    insertSnapshotDiff,
    getExistingDatesForUrl,
    getSnapshotsByUrl,
    getDb,
} from './db.js';
import { fetchLiveSnapshot } from './live-snapshot.js';

const CDX_BASE = 'https://web.archive.org/cdx/search/cdx';
const WEB_BASE = 'https://web.archive.org/web/';
const MAX_CONCURRENT = 2;
const MAX_RETRIES = 10;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;


export async function syncUrl(url, onProgress) {
    const progress = { url, current: 0, total: 0, done: false, phase: 'discovering' };
    onProgress(progress);

    const [cdxEntries, boundaryEntries] = await Promise.all([
        fetchCdxEntries(url),
        fetchBoundaryEntries(url),
    ]);

    const existingDates = new Set(getExistingDatesForUrl(url, 'wayback'));
    const seen = new Set();

    const toDownload = cdxEntries.concat(boundaryEntries).filter(function (entry) {
        const date = timestampToDate(entry.timestamp);
        if (existingDates.has(date) || seen.has(date)) {
            return false;
        }
        seen.add(date);
        return true;
    });

    progress.total = toDownload.length + 1;
    progress.phase = 'downloading';
    onProgress(progress);

    const livePromise = downloadLiveSnapshot(url);

    await downloadPool(toDownload, url, function () {
        ++progress.current;
        onProgress({ ...progress });
    });

    try {
        const liveHtml = await livePromise;
        if (liveHtml) {
            storeSnapshot(url, todayDate(), 'live', null, liveHtml);
        }
    } catch (err) {
        console.error('Live snapshot failed:', err.message);
    }

    ++progress.current;
    progress.done = true;
    progress.phase = 'processing';
    onProgress(progress);

    computeDiffsForUrl(url);

    progress.phase = 'complete';
    onProgress(progress);
}


async function fetchCdxEntries(url) {
    const params = new URLSearchParams({
        url,
        output: 'json',
        fl: 'timestamp,digest,statuscode',
        collapse: 'digest',
        filter: 'statuscode:200',
    });

    const response = await fetchWithRetry(`${CDX_BASE}?${params.toString()}`);
    const text = await response.text();

    if (!text.trim()) return [];

    const rows = JSON.parse(text);
    if (rows.length <= 1) return [];

    return rows.slice(1).map(function (row) {
        return { timestamp: row[0], digest: row[1], statuscode: row[2] };
    });
}


/**
 * Fetch full (uncollapsed) CDX timeline and return the last capture before each digest change.
 * These "boundary" snapshots narrow the uncertainty window for when a change actually happened.
 */
async function fetchBoundaryEntries(url) {
    const params = new URLSearchParams({
        url,
        output: 'json',
        fl: 'timestamp,digest,statuscode',
        filter: 'statuscode:200',
    });

    let response;
    try {
        response = await fetchWithRetry(`${CDX_BASE}?${params.toString()}`);
    } catch (err) {
        console.error('Boundary CDX fetch failed:', err.message);
        return [];
    }

    const text = await response.text();
    if (!text.trim()) {
        return [];
    }

    const rows = JSON.parse(text);
    if (rows.length <= 2) {
        return [];
    }

    const entries = rows.slice(1);
    const boundaries = [];
    for (let i = 0, i_max = entries.length - 1; i < i_max; ++i) {
        if (entries[i][1] !== entries[i + 1][1]) {
            boundaries.push({
                timestamp: entries[i][0],
                digest: entries[i][1],
                statuscode: entries[i][2],
            });
        }
    }
    return boundaries;
}


async function downloadPool(entries, url, onEach) {
    let idx = 0;

    async function worker() {
        while (idx < entries.length) {
            const entry = entries[idx++];
            try {
                const html = await downloadWaybackPage(url, entry.timestamp);
                storeSnapshot(url, timestampToDate(entry.timestamp), 'wayback', entry.digest, html);
            } catch (err) {
                console.error(`Failed to download ${entry.timestamp} after ${MAX_RETRIES} retries:`, err.message);
            }
            onEach();
        }
    }

    const workers = [];
    for (let i = 0, i_max = Math.min(MAX_CONCURRENT, entries.length); i < i_max; ++i) {
        workers.push(worker());
    }
    await Promise.all(workers);
}


async function downloadWaybackPage(url, timestamp) {
    const waybackUrl = `${WEB_BASE}${timestamp}id_/${url}`;
    const response = await fetchWithRetry(waybackUrl);
    return await response.text();
}


function storeSnapshot(url, date, source, digest, html) {
    const parsed = parseSnapshot(html);
    const htmlCompressed = compress(html);

    insertSnapshot({
        url,
        date,
        source,
        digest: digest || null,
        html_compressed: htmlCompressed,
        plaintext: parsed.plaintext,
        title: parsed.title,
        meta_description: parsed.meta_description,
        headlines_json: parsed.headlines_json,
        classes_ids_json: parsed.classes_ids_json,
    });
}


function computeDiffsForUrl(url) {
    const snapshots = getSnapshotsByUrl(url);
    if (snapshots.length < 2) return;

    const tx = getDb().transaction(function () {
        for (let i = 0, i_max = snapshots.length - 1; i < i_max; ++i) {
            const current = snapshots[i];
            const previous = snapshots[i + 1];

            const diffs = computeAllDiffs(current, previous);
            insertSnapshotDiff({
                snapshot_id: current.id,
                prev_snapshot_id: previous.id,
                ...diffs,
            });
        }
    });
    tx();
}


async function downloadLiveSnapshot(url) {
    return await fetchLiveSnapshot(url);
}


async function fetchWithRetry(url) {
    let backoff = INITIAL_BACKOFF_MS;

    for (let attempt = 0; attempt <= MAX_RETRIES; ++attempt) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'ArchiveAccelerator/0.1',
                    'Accept': 'text/html, application/json',
                },
            });

            if (response.status === 429 || response.status >= 500) {
                throw new Error(`HTTP ${response.status}`);
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return response;
        } catch (err) {
            if (attempt === MAX_RETRIES) {
                throw err;
            }

            const jitter = backoff * (0.5 + Math.random() * 0.5);
            await sleep(jitter);
            backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        }
    }
}


function timestampToDate(ts) {
    return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
}


function todayDate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}


function sleep(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}
