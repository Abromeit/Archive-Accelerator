import { getValidAccessToken } from './gsc-auth.js';
import { getProvider, insertAnalyticsData, getAnalyticsData as getAnalyticsDataFromDb } from './db.js';

const SEARCH_ANALYTICS_BASE = 'https://searchconsole.googleapis.com/webmasters/v3/sites';


export async function syncAnalytics(url) {
    const provider = getProvider('gsc');
    if (!provider || !provider.connected || !provider.property) {
        throw new Error('GSC not connected or no property selected');
    }

    const accessToken = await getValidAccessToken();

    const endDate = todayDate();
    const startDate = monthsAgo(18);

    const rows = await fetchSearchAnalytics(provider.property, url, startDate, endDate, accessToken);

    if (rows.length > 0) {
        const dbRows = rows.map(function (row) {
            return {
                url,
                date: row.keys[0],
                clicks: row.clicks,
                impressions: row.impressions,
                position: Math.round(row.position * 10) / 10,
                provider: 'gsc',
            };
        });
        insertAnalyticsData(dbRows);
    }

    return getAnalyticsDataFromDb(url, 'gsc');
}


async function fetchSearchAnalytics(property, pageUrl, startDate, endDate, accessToken) {
    const encodedProperty = encodeURIComponent(property);
    const endpoint = `${SEARCH_ANALYTICS_BASE}/${encodedProperty}/searchAnalytics/query`;

    const allRows = [];
    let startRow = 0;
    const rowLimit = 25000;

    while (true) {
        const body = {
            startDate,
            endDate,
            dimensions: ['date'],
            dimensionFilterGroups: [{
                filters: [{
                    dimension: 'page',
                    expression: pageUrl,
                }],
            }],
            rowLimit,
            startRow,
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`GSC API error: ${response.status} ${text}`);
        }

        const data = await response.json();
        const rows = data.rows || [];
        allRows.push(...rows);

        if (rows.length < rowLimit) break;
        startRow += rowLimit;
    }

    return allRows;
}


function todayDate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}


function monthsAgo(n) {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
