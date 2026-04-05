import { compress } from './compression.js';
import { parseSnapshot } from './content-parser.js';
import { computeAllDiffs } from './diff-engine.js';
import {
    insertSnapshot,
    upsertSnapshot,
    insertSnapshotDiff,
    getExistingDatesForUrl,
    getSnapshotsByUrl,
    getDb,
    insertSyncLog,
} from './db.js';
import { fetchLiveSnapshot } from './live-snapshot.js';

const CDX_BASE = 'https://web.archive.org/cdx/search/cdx';
const WEB_BASE = 'https://web.archive.org/web/';
const MAX_CONCURRENT = 2;
const MAX_RETRIES = 10;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;


export async function syncUrl(url, onProgress, onLog) {
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    function log(level, phase, message) {
        const entry = { url, session_id: sessionId, timestamp: Date.now(), level, phase, message };
        try { insertSyncLog(entry); } catch (_e) { /* DB write must never break sync */ }
        if (onLog) {
            try { onLog(entry); } catch (_e) { /* callback must never break sync */ }
        }
    }

    const progress = { url, current: 0, total: 0, done: false, phase: 'discovering' };
    onProgress(progress);

    log('info', 'discovering', `Starting sync for ${url}`);
    log('info', 'discovering', 'Querying Wayback Machine CDX index — this may take a minute…');

    let cdxEntries, boundaryEntries;
    try {
        [cdxEntries, boundaryEntries] = await Promise.all([
            fetchCdxEntries(url),
            fetchBoundaryEntries(url),
        ]);
    } catch (err) {
        log('error', 'discovering', `CDX query failed: ${err.message}`);
        throw err;
    }

    const totalCandidates = cdxEntries.length + boundaryEntries.length;
    log('success', 'discovering',
        `Found ${cdxEntries.length} unique digests + ${boundaryEntries.length} boundary snapshots`
    );

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

    const skipped = totalCandidates - toDownload.length;
    if (existingDates.size > 0) {
        log('info', 'discovering',
            `${existingDates.size} dates already in database — ${toDownload.length} new to download`
        );
    } else if (skipped > 0) {
        log('info', 'discovering',
            `${toDownload.length} unique dates to download (${skipped} duplicate dates merged)`
        );
    }

    progress.total = toDownload.length + 1;
    progress.phase = 'downloading';
    onProgress(progress);

    log('info', 'downloading', `Downloading ${toDownload.length} snapshots + 1 live…`);

    const livePromise = downloadLiveSnapshot(url);

    await downloadPool(toDownload, url, log, function () {
        ++progress.current;
        onProgress({ ...progress });
    });

    try {
        log('info', 'downloading', 'Fetching live snapshot…');
        const liveHtml = await livePromise;
        if (liveHtml) {
            storeSnapshot(url, todayDate(), 'live', null, liveHtml, { upsert: true });
            log('success', 'downloading', 'Live snapshot stored');
        } else {
            log('warn', 'downloading', 'Live snapshot returned empty');
        }
    } catch (err) {
        log('error', 'downloading', `Live snapshot failed: ${err.message}`);
    }

    ++progress.current;
    progress.done = true;
    progress.phase = 'processing';
    onProgress(progress);

    log('info', 'processing', 'Computing diffs between snapshots…');
    computeDiffsForUrl(url);
    log('success', 'processing', 'Diff computation complete');

    progress.phase = 'complete';
    onProgress(progress);

    log('success', 'complete', `Sync finished — ${toDownload.length} new snapshots stored`);
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


async function downloadPool(entries, url, log, onEach) {
    let idx = 0;

    async function worker() {
        while (idx < entries.length) {
            const entry = entries[idx++];
            const date = timestampToDate(entry.timestamp);
            try {
                const html = await downloadWaybackPage(url, entry.timestamp);
                storeSnapshot(url, date, 'wayback', entry.digest, html);
                log('success', 'downloading', `${date} — stored (${formatBytes(html.length)})`);
            } catch (err) {
                log('error', 'downloading', `${date} — failed after ${MAX_RETRIES} retries: ${err.message}`);
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


function storeSnapshot(url, date, source, digest, html, { upsert = false } = {}) {
    const parsed = parseSnapshot(html);
    const htmlCompressed = compress(html);

    const row = {
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
        botview: parsed.botview,
    };

    if (upsert) {
        upsertSnapshot(row);
    } else {
        insertSnapshot(row);
    }
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


function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
}


function sleep(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}
