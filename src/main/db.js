import { app } from 'electron';
import { join } from 'node:path';
import Database from 'better-sqlite3';

let db = null;

export function initDb() {
    const dbPath = join(app.getPath('userData'), 'archive-accelerator.db');
    db = new Database(dbPath);

    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');

    migrate();
    return db;
}


export function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call initDb() first.');
    }
    return db;
}


function migrate() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS snapshots (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            url         TEXT    NOT NULL,
            date        TEXT    NOT NULL,
            source      TEXT    NOT NULL DEFAULT 'wayback',
            digest      TEXT,
            html_compressed   BLOB,
            plaintext         TEXT,
            title             TEXT,
            meta_description  TEXT,
            headlines_json    TEXT,
            classes_ids_json  TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_snapshots_url_date_source
            ON snapshots(url, date, source);

        CREATE TABLE IF NOT EXISTS snapshot_diffs (
            snapshot_id      INTEGER NOT NULL,
            prev_snapshot_id INTEGER NOT NULL,
            template_pct     REAL,
            text_pct         REAL,
            headlines_changed INTEGER DEFAULT 0,
            meta_pct         REAL,
            title_changed    INTEGER DEFAULT 0,
            UNIQUE(snapshot_id, prev_snapshot_id),
            FOREIGN KEY (snapshot_id)      REFERENCES snapshots(id),
            FOREIGN KEY (prev_snapshot_id) REFERENCES snapshots(id)
        );

        CREATE TABLE IF NOT EXISTS analytics_data (
            url        TEXT NOT NULL,
            date       TEXT NOT NULL,
            clicks     INTEGER,
            impressions INTEGER,
            position   REAL,
            provider   TEXT NOT NULL DEFAULT 'gsc',
            UNIQUE(url, date, provider)
        );

        CREATE INDEX IF NOT EXISTS idx_analytics_url_date
            ON analytics_data(url, date);

        CREATE TABLE IF NOT EXISTS providers (
            id            TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            connected     INTEGER DEFAULT 0,
            property      TEXT,
            access_token  TEXT,
            refresh_token TEXT,
            token_expiry  INTEGER
        );

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT
        );
    `);
}


export function insertSnapshot(row) {
    const stmt = getDb().prepare(`
        INSERT INTO snapshots (url, date, source, digest, html_compressed, plaintext, title, meta_description, headlines_json, classes_ids_json)
        VALUES (@url, @date, @source, @digest, @html_compressed, @plaintext, @title, @meta_description, @headlines_json, @classes_ids_json)
    `);
    return stmt.run(row);
}


export function getSnapshotsByUrl(url) {
    return getDb().prepare(`
        SELECT id, url, date, source, digest, plaintext, title, meta_description, headlines_json, classes_ids_json
        FROM snapshots
        WHERE url = ?
        ORDER BY date DESC
    `).all(url);
}


export function getSnapshotsWithDiffs(url) {
    return getDb().prepare(`
        SELECT
            s.id, s.url, s.date, s.source, s.digest,
            s.plaintext, s.title, s.meta_description,
            s.headlines_json, s.classes_ids_json,
            d.template_pct, d.text_pct, d.headlines_changed, d.meta_pct, d.title_changed
        FROM snapshots s
        LEFT JOIN snapshot_diffs d ON d.snapshot_id = s.id
        WHERE s.url = ?
        ORDER BY s.date DESC
    `).all(url);
}


export function getSnapshotHtml(id) {
    const row = getDb().prepare('SELECT html_compressed FROM snapshots WHERE id = ?').get(id);
    return row ? row.html_compressed : null;
}


export function getSnapshotById(id) {
    return getDb().prepare(`
        SELECT id, url, date, source, digest, plaintext, title, meta_description, headlines_json, classes_ids_json
        FROM snapshots
        WHERE id = ?
    `).get(id);
}


export function getExistingDatesForUrl(url, source) {
    return getDb().prepare(
        'SELECT date FROM snapshots WHERE url = ? AND source = ?'
    ).all(url, source).map((r) => r.date);
}


export function insertSnapshotDiff(row) {
    getDb().prepare(`
        INSERT OR REPLACE INTO snapshot_diffs (snapshot_id, prev_snapshot_id, template_pct, text_pct, headlines_changed, meta_pct, title_changed)
        VALUES (@snapshot_id, @prev_snapshot_id, @template_pct, @text_pct, @headlines_changed, @meta_pct, @title_changed)
    `).run(row);
}


export function getDiffsForSnapshots(snapshotIds) {
    if (!snapshotIds.length) return [];
    const placeholders = snapshotIds.map(() => '?').join(',');
    return getDb().prepare(`
        SELECT * FROM snapshot_diffs
        WHERE snapshot_id IN (${placeholders})
    `).all(...snapshotIds);
}


export function insertAnalyticsData(rows) {
    const stmt = getDb().prepare(`
        INSERT OR REPLACE INTO analytics_data (url, date, clicks, impressions, position, provider)
        VALUES (@url, @date, @clicks, @impressions, @position, @provider)
    `);
    const tx = getDb().transaction(function (items) {
        for (let i = 0, i_max = items.length; i < i_max; ++i) {
            stmt.run(items[i]);
        }
    });
    tx(rows);
}


export function getAnalyticsData(url, provider) {
    return getDb().prepare(`
        SELECT date, clicks, impressions, position
        FROM analytics_data
        WHERE url = ? AND provider = ?
        ORDER BY date ASC
    `).all(url, provider || 'gsc');
}


export function getProvider(id) {
    return getDb().prepare('SELECT * FROM providers WHERE id = ?').get(id);
}


export function upsertProvider(row) {
    getDb().prepare(`
        INSERT INTO providers (id, name, connected, property, access_token, refresh_token, token_expiry)
        VALUES (@id, @name, @connected, @property, @access_token, @refresh_token, @token_expiry)
        ON CONFLICT(id) DO UPDATE SET
            name = @name,
            connected = @connected,
            property = @property,
            access_token = @access_token,
            refresh_token = @refresh_token,
            token_expiry = @token_expiry
    `).run(row);
}


export function disconnectProvider(id) {
    getDb().prepare(`
        UPDATE providers SET connected = 0, access_token = NULL, refresh_token = NULL, token_expiry = NULL
        WHERE id = ?
    `).run(id);
}


export function getAllProviders() {
    return getDb().prepare('SELECT id, name, connected, property FROM providers').all();
}


export function getSetting(key) {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
}


export function setSetting(key, value) {
    getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}


export function getPageInfo(url) {
    const row = getDb().prepare(`
        SELECT
            COUNT(*) AS documentCount,
            MIN(date) AS firstDate,
            MAX(date) AS lastDate
        FROM snapshots
        WHERE url = ?
    `).get(url);

    if (!row || row.documentCount === 0) return null;
    return { url, documentCount: row.documentCount, firstDate: row.firstDate, lastDate: row.lastDate };
}


export function bulkInsertSnapshots(rows) {
    const stmt = getDb().prepare(`
        INSERT INTO snapshots (url, date, source, digest, html_compressed, plaintext, title, meta_description, headlines_json, classes_ids_json)
        VALUES (@url, @date, @source, @digest, @html_compressed, @plaintext, @title, @meta_description, @headlines_json, @classes_ids_json)
    `);
    const tx = getDb().transaction(function (items) {
        const results = [];
        for (let i = 0, i_max = items.length; i < i_max; ++i) {
            results.push(stmt.run(items[i]));
        }
        return results;
    });
    return tx(rows);
}
