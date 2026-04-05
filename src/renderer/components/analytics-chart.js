import { LitElement, html } from 'lit';
import * as echarts from 'echarts';
import * as dataService from '../services/data-service.js';

/**
 * GSC-style metric hues at ~Tailwind *-400 luminance (same band as icon green #34d399 / emerald-400)
 * so lines read clearly on dark UI without heavy saturation.
 */
const GSC_CLICKS = '#60a5fa';
const GSC_IMPRESSIONS = '#a78bfa';
const GSC_POSITION = '#fb923c';


function parseYmd(dateStr) {
    const parts = dateStr.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(y, m, day);
}


function formatYmd(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}


/**
 * Bucket start for weekly (Monday) / monthly (calendar month) / daily.
 * Position aggregation across buckets: weighted by impressions, equivalent to
 * SUM(sum_top_position)/SUM(impressions)+1 when using per-row (position-1)*impressions.
 */
function bucketKeyForGranularity(dateStr, granularity) {
    if (granularity === 'daily') {
        return dateStr;
    }
    const d = parseYmd(dateStr);
    if (granularity === 'monthly') {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    if (granularity === 'weekly') {
        const mondayOffset = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - mondayOffset);
        return formatYmd(d);
    }
    return dateStr;
}


function getMonthKeyFromCategory(cat, granularity) {
    if (granularity === 'monthly') {
        return cat;
    }
    const parts = String(cat).split('-');
    if (parts.length >= 3) {
        return `${parts[0]}-${parts[1]}`;
    }
    if (parts.length === 2) {
        return cat;
    }
    return String(cat);
}


/**
 * First x-axis tick: real category date (series start), YYYY-MM-DD.
 */
function formatAxisLabelSeriesStart(cat, granularity) {
    if (granularity === 'monthly') {
        const parts = String(cat).split('-');
        if (parts.length >= 2) {
            const y = parts[0];
            const m = String(parseInt(parts[1], 10)).padStart(2, '0');
            return `${y}-${m}-01`;
        }
        return String(cat);
    }
    const parts = String(cat).split('-');
    if (parts.length >= 3) {
        return formatYmd(parseYmd(cat));
    }
    if (parts.length === 2) {
        const y = parts[0];
        const m = String(parseInt(parts[1], 10)).padStart(2, '0');
        return `${y}-${m}-01`;
    }
    return String(cat);
}


/**
 * Later month-boundary ticks: calendar first of that month (not the first day present in the data).
 */
function formatAxisLabelMonthStart(cat, granularity) {
    if (granularity === 'monthly') {
        const parts = String(cat).split('-');
        if (parts.length >= 2) {
            const y = parts[0];
            const m = String(parseInt(parts[1], 10)).padStart(2, '0');
            return `${y}-${m}-01`;
        }
        return String(cat);
    }
    const parts = String(cat).split('-');
    if (parts.length >= 3) {
        const d = parseYmd(cat);
        d.setDate(1);
        return formatYmd(d);
    }
    if (parts.length === 2) {
        const y = parts[0];
        const m = String(parseInt(parts[1], 10)).padStart(2, '0');
        return `${y}-${m}-01`;
    }
    return String(cat);
}


function monthBoundaryAxisLabelFormatter(dates, granularity) {
    return function (val, index) {
        const idx = typeof index === 'number' ? index : dates.indexOf(val);
        if (idx < 0 || idx >= dates.length) {
            return '';
        }
        const mk = getMonthKeyFromCategory(dates[idx], granularity);
        if (idx > 0) {
            const prevMk = getMonthKeyFromCategory(dates[idx - 1], granularity);
            if (prevMk === mk) {
                return '';
            }
        }
        if (idx === 0) {
            return formatAxisLabelSeriesStart(dates[idx], granularity);
        }
        return formatAxisLabelMonthStart(dates[idx], granularity);
    };
}


function getYAxis(coordSys) {
    if (coordSys.getAxis) {
        return coordSys.getAxis('y');
    }
    return coordSys.yAxis;
}


/**
 * Pixel Y of the bottom edge of the grid (category axis line).
 */
function getGridBottomY(coordSys) {
    if (coordSys.getArea) {
        const area = coordSys.getArea();
        if (area && typeof area.height === 'number') {
            return area.y + area.height;
        }
    }
    if (coordSys.getRect) {
        const rect = coordSys.getRect();
        if (rect && typeof rect.height === 'number') {
            return rect.y + rect.height;
        }
    }
    const yAxis = getYAxis(coordSys);
    if (yAxis && yAxis.scale) {
        const ext = yAxis.scale.getExtent();
        const yMid = (ext[0] + ext[1]) / 2;
        const pt = coordSys.dataToPoint([0, yMid]);
        return pt[1];
    }
    const pt = coordSys.dataToPoint([0, 0]);
    return pt[1];
}


function getGridArea(coordSys) {
    if (coordSys.getArea) {
        const area = coordSys.getArea();
        if (area && typeof area.height === 'number') {
            return area;
        }
    }
    if (coordSys.getRect) {
        const rect = coordSys.getRect();
        if (rect && typeof rect.height === 'number') {
            return rect;
        }
    }
    return null;
}


/**
 * Index of the x-axis category bucket for a calendar date (matches chart aggregation).
 */
function findCategoryIndexForDate(dateStr, dates, granularity) {
    if (!dateStr || !dates.length) {
        return 0;
    }
    const key = bucketKeyForGranularity(dateStr, granularity);
    let idx = dates.indexOf(key);
    if (idx !== -1) {
        return idx;
    }
    let i = 0;
    const i_max = dates.length;
    while (i < i_max) {
        if (dates[i] >= dateStr) {
            return i;
        }
        ++i;
    }
    return dates.length - 1;
}


/**
 * Pixel rectangle covering category indices [idxFrom, idxTo] inclusive over the grid plot area.
 * Edges align with category centers (where dashed mark lines sit).
 */
function getUncertaintyBandPixelRect(coordSys, idxFrom, idxTo, categoryCount) {
    const area = getGridArea(coordSys);
    if (!area) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }
    const yTop = area.y;
    const h = area.height;
    const x0 = coordSys.dataToPoint([idxFrom, 0])[0];
    const x1 = coordSys.dataToPoint([idxTo, 0])[0];
    let xLeft = Math.min(x0, x1);
    let xRight = Math.max(x0, x1);
    const MIN_WIDTH = 6;
    if (xRight - xLeft < MIN_WIDTH) {
        const mid = (xLeft + xRight) / 2;
        xLeft = mid - MIN_WIDTH / 2;
        xRight = mid + MIN_WIDTH / 2;
    }
    return {
        x: xLeft,
        y: yTop,
        width: xRight - xLeft,
        height: h,
    };
}


const ZEBRA_A = 'rgba(255, 255, 255, 0.045)';
const ZEBRA_B = 'rgba(255, 255, 255, 0.012)';


/**
 * Vertical bands by calendar month; uses category indices so a single monthly bucket still gets width.
 */
function buildMonthZebraMarkAreaData(dates, granularity) {
    if (!dates.length) {
        return [];
    }
    const out = [];
    let i = 0;
    let stripe = 0;
    while (i < dates.length) {
        const mk = getMonthKeyFromCategory(dates[i], granularity);
        let j = i;
        while (j + 1 < dates.length && getMonthKeyFromCategory(dates[j + 1], granularity) === mk) {
            ++j;
        }
        const color = stripe % 2 === 0 ? ZEBRA_A : ZEBRA_B;
        out.push([
            {
                xAxis: i,
                itemStyle: { color: color, borderWidth: 0 },
                emphasis: { disabled: true },
            },
            {
                xAxis: j,
                emphasis: { disabled: true },
            },
        ]);
        ++stripe;
        i = j + 1;
    }
    return out;
}


export class AnalyticsChart extends LitElement {
    static properties = {
        currentUrl: { type: String },
        snapshots: { type: Array },
        _connected: { type: Boolean, state: true },
        _prefs: { type: Object, state: true },
        _analyticsData: { type: Array, state: true },
        _analyticsLoading: { type: Boolean, state: true },
        _analyticsError: { type: String, state: true },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.currentUrl = '';
        this.snapshots = [];
        this._connected = false;
        this._prefs = {
            clicks: true,
            impressions: true,
            position: false,
            granularity: 'daily',
            iconTemplate: false,
            iconText: true,
            iconMeta: true,
        };
        this._loadPrefs();
        this._analyticsData = [];
        this._analyticsLoading = false;
        this._analyticsError = null;
        this._chart = null;
        this._resizeObserver = null;
        this._chartAxisKey = null;
        this._savedDataZoom = { start: 0, end: 100 };
    }

    connectedCallback() {
        super.connectedCallback();
        this._checkConnection();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._destroyChart();
    }

    updated(changed) {
        if (changed.has('currentUrl') || changed.has('_connected')) {
            this._loadData();
        }
        if (
            changed.has('_analyticsData') ||
            changed.has('_prefs') ||
            changed.has('snapshots') ||
            changed.has('_analyticsLoading')
        ) {
            this._updateChart();
        }
    }

    async _loadPrefs() {
        const stored = await dataService.getChartPreferences();
        this._prefs = {
            clicks: true,
            impressions: true,
            position: false,
            granularity: 'daily',
            iconTemplate: false,
            iconText: true,
            iconMeta: true,
            ...stored,
        };
        const g = this._prefs.granularity;
        if (g !== 'daily' && g !== 'weekly' && g !== 'monthly') {
            this._prefs = { ...this._prefs, granularity: 'daily' };
        }
    }

    async _checkConnection() {
        const providers = await dataService.getConnectedProviders();
        this._connected = providers.some((p) => p.connected);
    }

    async _loadData() {
        if (!this._connected || !this.currentUrl) {
            this._analyticsData = [];
            this._analyticsError = null;
            this._analyticsLoading = false;
            return;
        }

        this._analyticsLoading = true;
        this._analyticsError = null;

        try {
            this._analyticsData = await dataService.syncAnalytics(this.currentUrl);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this._analyticsError = message;
            try {
                this._analyticsData = await dataService.getAnalyticsData(this.currentUrl);
            } catch {
                this._analyticsData = [];
            }
        } finally {
            this._analyticsLoading = false;
        }
    }

    _toggleMetric(metric) {
        this._prefs = { ...this._prefs, [metric]: !this._prefs[metric] };
        dataService.setChartPreferences(this._prefs);
    }

    _toggleIcon(iconType) {
        const key = 'icon' + iconType.charAt(0).toUpperCase() + iconType.slice(1);
        this._prefs = { ...this._prefs, [key]: !this._prefs[key] };
        dataService.setChartPreferences(this._prefs);
    }

    _isChangeVisible(c) {
        if (c.templateChanged && this._prefs.iconTemplate) return true;
        if (c.textChanged && this._prefs.iconText) return true;
        if (c.metaChanged && this._prefs.iconMeta) return true;
        return false;
    }

    _handleProviderConnected() {
        this._checkConnection();
    }

    _getSnapshotChanges() {
        const snaps = this.snapshots;
        const out = [];
        let i = 0;
        const i_max = snaps.length;
        while (i < i_max) {
            const s = snaps[i];
            if (s.templateChanged || s.textChanged || s.metaChanged) {
                const prev = snaps[i + 1];
                out.push({
                    date: s.date,
                    previousSnapshotDate: prev ? prev.date : null,
                    templateChanged: s.templateChanged,
                    textChanged: s.textChanged,
                    headlinesChanged: s.headlinesChanged,
                    metaChanged: s.metaChanged,
                    titleChanged: s.titleChanged,
                });
            }
            ++i;
        }
        return out;
    }


    _aggregateAnalyticsData(rows, granularity) {
        if (granularity === 'daily') {
            return rows.map(function (r) {
                return {
                    date: r.date,
                    clicks: r.clicks,
                    impressions: r.impressions,
                    position: r.position,
                };
            });
        }

        const groups = new Map();
        for (let i = 0, n = rows.length; i < n; ++i) {
            const row = rows[i];
            const key = bucketKeyForGranularity(row.date, granularity);
            if (!groups.has(key)) {
                groups.set(key, {
                    clicks: 0,
                    impressions: 0,
                    sumPositionTimesImpressions: 0,
                });
            }
            const g = groups.get(key);
            const clicks = row.clicks || 0;
            const impr = row.impressions || 0;
            g.clicks += clicks;
            g.impressions += impr;
            if (impr > 0 && row.position != null && !Number.isNaN(row.position)) {
                g.sumPositionTimesImpressions += row.position * impr;
            }
        }

        const keys = Array.from(groups.keys()).sort();
        const out = [];
        for (let i = 0, i_max = keys.length; i < i_max; ++i) {
            const key = keys[i];
            const g = groups.get(key);
            let pos = null;
            if (g.impressions > 0 && g.sumPositionTimesImpressions > 0) {
                pos = Math.round((g.sumPositionTimesImpressions / g.impressions) * 10) / 10;
            }
            out.push({
                date: key,
                clicks: g.clicks,
                impressions: g.impressions,
                position: pos,
            });
        }
        return out;
    }


    _mergeChangesForGranularity(changes, granularity) {
        if (granularity === 'daily') {
            return changes.map(function (c) {
                return {
                    date: c.date,
                    dates: [c.date],
                    previousSnapshotDate: c.previousSnapshotDate ?? null,
                    templateChanged: !!c.templateChanged,
                    textChanged: !!c.textChanged,
                    headlinesChanged: !!c.headlinesChanged,
                    metaChanged: !!c.metaChanged,
                    titleChanged: !!c.titleChanged,
                };
            });
        }

        const map = new Map();
        for (let i = 0, n = changes.length; i < n; ++i) {
            const c = changes[i];
            const key = bucketKeyForGranularity(c.date, granularity);
            const prevD = c.previousSnapshotDate ?? null;
            if (!map.has(key)) {
                map.set(key, {
                    date: key,
                    dates: [c.date],
                    previousSnapshotDate: prevD,
                    templateChanged: !!c.templateChanged,
                    textChanged: !!c.textChanged,
                    headlinesChanged: !!c.headlinesChanged,
                    metaChanged: !!c.metaChanged,
                    titleChanged: !!c.titleChanged,
                });
            } else {
                const m = map.get(key);
                m.templateChanged = m.templateChanged || c.templateChanged;
                m.textChanged = m.textChanged || c.textChanged;
                m.headlinesChanged = m.headlinesChanged || c.headlinesChanged;
                m.metaChanged = m.metaChanged || c.metaChanged;
                m.titleChanged = m.titleChanged || c.titleChanged;
                if (m.dates.indexOf(c.date) === -1) {
                    m.dates.push(c.date);
                }
                if (
                    prevD &&
                    (!m.previousSnapshotDate || prevD < m.previousSnapshotDate)
                ) {
                    m.previousSnapshotDate = prevD;
                }
            }
        }
        return Array.from(map.values());
    }


    _onGranularityChange(e) {
        const g = e.target.value;
        if (g !== 'daily' && g !== 'weekly' && g !== 'monthly') {
            return;
        }
        this._prefs = { ...this._prefs, granularity: g };
        dataService.setChartPreferences(this._prefs);
    }

    _initChart() {
        const container = this.querySelector('#analytics-chart-container');
        if (!container) return;

        this._destroyChart();
        this._chart = echarts.init(container, null, { renderer: 'canvas' });

        const onDataZoom = () => {
            const opt = this._chart.getOption();
            const dz = opt.dataZoom;
            if (Array.isArray(dz) && dz[0]) {
                const d0 = dz[0];
                if (typeof d0.start === 'number' && typeof d0.end === 'number') {
                    this._savedDataZoom = { start: d0.start, end: d0.end };
                }
            }
            this._scheduleDrawChangeIcons();
        };
        this._chart.on('datazoom', onDataZoom);

        this._resizeObserver = new ResizeObserver(() => {
            this._chart?.resize();
            this._scheduleDrawChangeIcons();
        });
        this._resizeObserver.observe(container);
    }

    _destroyChart() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        if (this._chart) {
            this._chart.dispose();
            this._chart = null;
        }
        this._chartAxisKey = null;
        this._savedDataZoom = { start: 0, end: 100 };
    }

    /**
     * Defer icon layout until after ECharts has applied grid/series layout. Calling
     * dataToPoint immediately after setOption uses stale coordinates (wrong KPI layout).
     */
    _scheduleDrawChangeIcons() {
        const chart = this._chart;
        if (!chart) {
            return;
        }
        if (this._drawIconsRaf) {
            cancelAnimationFrame(this._drawIconsRaf);
        }
        this._drawIconsRaf = requestAnimationFrame(() => {
            this._drawIconsRaf = null;
            if (this._chart !== chart) {
                return;
            }
            this._drawChangeIcons();
        });
    }

    _updateChart() {
        if (this._analyticsLoading) {
            return;
        }

        if (!this._analyticsData.length) {
            this._destroyChart();
            return;
        }

        requestAnimationFrame(() => {
            if (!this._chart) {
                this._initChart();
            }
            if (!this._chart) return;

            const granularity = this._prefs.granularity || 'daily';
            const displayData = this._aggregateAnalyticsData(this._analyticsData, granularity);
            const dates = displayData.map((d) => d.date);
            const axisKey = `${granularity}|${dates.length}|${dates[0] ?? ''}|${dates[dates.length - 1] ?? ''}`;
            if (this._chartAxisKey !== axisKey) {
                this._chartAxisKey = axisKey;
                this._savedDataZoom = { start: 0, end: 100 };
            }
            const zoomStart = this._savedDataZoom.start;
            const zoomEnd = this._savedDataZoom.end;
            const changesMerged = this._mergeChangesForGranularity(
                this._getSnapshotChanges(),
                granularity,
            );

            const markLineData = changesMerged
                .filter((c) => dates.includes(c.date) && this._isChangeVisible(c))
                .map((c) => ({
                    xAxis: c.date,
                    label: { show: false },
                    lineStyle: {
                        color: '#737373',
                        type: 'dashed',
                        width: 1,
                    },
                }));

            const showClicks = this._prefs.clicks;
            const showImpr = this._prefs.impressions;
            const showPos = this._prefs.position;

            const yAxis = [];
            let idxClick = -1;
            let idxImpr = -1;
            let idxPos = -1;

            if (showClicks) {
                idxClick = yAxis.length;
                yAxis.push({
                    type: 'value',
                    position: 'left',
                    offset: 0,
                    name: 'Clicks',
                    nameTextStyle: { color: GSC_CLICKS, fontSize: 10 },
                    axisLine: { show: false },
                    axisLabel: { color: GSC_CLICKS, fontSize: 10 },
                    splitLine: showImpr ? { show: false } : { lineStyle: { color: '#262626' } },
                    min: 0,
                });
            }

            if (showImpr) {
                idxImpr = yAxis.length;
                yAxis.push({
                    type: 'value',
                    position: 'left',
                    offset: showClicks ? 56 : 0,
                    name: 'Impressions',
                    nameTextStyle: { color: GSC_IMPRESSIONS, fontSize: 10 },
                    axisLine: { show: false },
                    axisLabel: { color: GSC_IMPRESSIONS, fontSize: 10 },
                    splitLine: { lineStyle: { color: '#262626' } },
                    min: 0,
                });
            }

            if (showPos) {
                idxPos = yAxis.length;
                yAxis.push({
                    type: 'value',
                    position: 'right',
                    name: 'Position',
                    nameLocation: 'start',
                    nameGap: 8,
                    nameTextStyle: { color: GSC_POSITION, fontSize: 10 },
                    axisLine: { show: false },
                    axisLabel: { color: GSC_POSITION, fontSize: 10 },
                    splitLine: { show: false },
                    inverse: true,
                    min: 1,
                });
            }

            const series = [];

            if (showClicks) {
                series.push({
                    name: 'Clicks',
                    type: 'line',
                    yAxisIndex: idxClick,
                    data: displayData.map((d) => d.clicks),
                    smooth: false,
                    symbol: 'none',
                    lineStyle: { color: GSC_CLICKS, width: 2 },
                    itemStyle: { color: GSC_CLICKS },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(96, 165, 250, 0.14)' },
                            { offset: 1, color: 'rgba(96, 165, 250, 0)' },
                        ]),
                    },
                    markLine: series.length === 0 ? { data: markLineData, silent: true, symbol: ['none', 'none'] } : undefined,
                });
            }

            if (showImpr) {
                series.push({
                    name: 'Impressions',
                    type: 'line',
                    yAxisIndex: idxImpr,
                    data: displayData.map((d) => d.impressions),
                    smooth: false,
                    symbol: 'none',
                    lineStyle: { color: GSC_IMPRESSIONS, width: 2 },
                    itemStyle: { color: GSC_IMPRESSIONS },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(167, 139, 250, 0.12)' },
                            { offset: 1, color: 'rgba(167, 139, 250, 0)' },
                        ]),
                    },
                    markLine: series.length === 0 ? { data: markLineData, silent: true, symbol: ['none', 'none'] } : undefined,
                });
            }

            if (showPos) {
                series.push({
                    name: 'Position',
                    type: 'line',
                    yAxisIndex: idxPos,
                    data: displayData.map((d) => d.position),
                    smooth: false,
                    symbol: 'none',
                    lineStyle: { color: GSC_POSITION, width: 2 },
                    itemStyle: { color: GSC_POSITION },
                    markLine: series.length === 0 ? { data: markLineData, silent: true, symbol: ['none', 'none'] } : undefined,
                });
            }

            if (series.length > 0 && !series.some((s) => s.markLine)) {
                series[0].markLine = { data: markLineData, silent: true, symbol: ['none', 'none'] };
            }

            const zebraData = buildMonthZebraMarkAreaData(dates, granularity);
            if (series.length > 0 && zebraData.length > 0) {
                series[0].markArea = {
                    silent: true,
                    z: -20,
                    data: zebraData,
                };
            }

            const changeDates = changesMerged.filter(
                (c) => dates.includes(c.date) && this._isChangeVisible(c),
            );
            this._pendingChangeIcons =
                changeDates.length > 0 ? { changeDates, dates, granularity } : null;

            let gridLeft = 60;
            if (showClicks && showImpr) {
                gridLeft = 104;
            } else if (!showClicks && !showImpr && showPos) {
                gridLeft = 24;
            }

            const option = {
                animation: false,
                backgroundColor: 'transparent',
                tooltip: {
                    trigger: 'axis',
                    backgroundColor: '#262626',
                    borderColor: '#404040',
                    textStyle: { color: '#f5f5f5', fontSize: 12 },
                },
                legend: {
                    show: false,
                },
                grid: {
                    top: 30,
                    right: showPos ? 60 : 20,
                    left: gridLeft,
                    bottom: 76,
                    containLabel: true,
                },
                dataZoom: [
                    {
                        type: 'slider',
                        xAxisIndex: 0,
                        start: zoomStart,
                        end: zoomEnd,
                        filterMode: 'none',
                        height: 40,
                        bottom: 20,
                        showDetail: false,
                        showDataShadow: true,
                        brushSelect: false,
                        borderColor: '#2a2a2a',
                        backgroundColor: '#171717',
                        fillerColor: 'rgba(59, 130, 246, 0.18)',
                        handleStyle: {
                            color: '#262626',
                            borderColor: '#525252',
                        },
                        emphasis: {
                            handleStyle: {
                                color: '#2a2a2a',
                                borderColor: '#60a5fa',
                            },
                        },
                        dataBackground: {
                            lineStyle: { color: 'rgba(96, 165, 250, 0.28)', width: 1 },
                            areaStyle: { color: 'rgba(96, 165, 250, 0.04)' },
                        },
                        selectedDataBackground: {
                            lineStyle: { color: 'rgba(96, 165, 250, 0.38)', width: 1 },
                            areaStyle: { color: 'rgba(96, 165, 250, 0.08)' },
                        },
                        textStyle: { color: '#737373', fontSize: 10 },
                    },
                ],
                xAxis: {
                    type: 'category',
                    data: dates,
                    axisLine: { lineStyle: { color: '#404040' } },
                    axisLabel: {
                        color: '#737373',
                        fontSize: 10,
                        interval: 0,
                        hideOverlap: false,
                        rotate: 45,
                        margin: 14,
                        align: 'right',
                        verticalAlign: 'top',
                        inside: false,
                        formatter: monthBoundaryAxisLabelFormatter(dates, granularity),
                    },
                    axisTick: { show: false },
                },
                yAxis,
                series,
            };

            this._chart.setOption(option, true);
            this._scheduleDrawChangeIcons();
        });
    }

    _drawChangeIcons() {
        if (!this._chart || !this._pendingChangeIcons) {
            this._chart?.setOption({ graphic: [] }, { replaceMerge: ['graphic'] });
            return;
        }

        const { changeDates, dates, granularity } = this._pendingChangeIcons;
        const chart = this._chart;
        const coordSys = chart.getModel().getSeriesByIndex(0)?.coordinateSystem;
        if (!coordSys) return;

        const container = this.querySelector('#analytics-chart-container');
        let tooltipDiv = this.querySelector('#chart-icon-tooltip');
        if (!tooltipDiv) {
            tooltipDiv = document.createElement('div');
            tooltipDiv.id = 'chart-icon-tooltip';
            tooltipDiv.style.cssText = `
                position: absolute; pointer-events: none; opacity: 0;
                background: #262626; border: 1px solid #404040; color: #f5f5f5;
                font-size: 11px; padding: 4px 8px; white-space: nowrap;
                transition: opacity 0.1s; z-index: 200; line-height: 1.4;
            `;
            container.style.position = 'relative';
            container.style.overflow = 'hidden';
            container.appendChild(tooltipDiv);
        }
        const containerW = container.offsetWidth;

        const S = 12;
        const GAP = 2;
        const MARGIN_BELOW_AXIS = 6;
        const GREEN = '#34d399';
        const BG = '#1F1F1F';
        const LABELS = {
            template: 'template changed',
            text: 'text changed',
            headlines: 'text changed\nwith headlines',
            meta: 'meta changed',
            title: 'meta changed\nwith title tag',
        };
        const elements = [];
        const BAND_FILL = 'rgba(52, 211, 153, 0.16)';

        elements.push({
            type: 'rect',
            id: 'change-uncertainty-band',
            ignore: true,
            shape: { x: 0, y: 0, width: 0, height: 0 },
            style: { fill: BAND_FILL },
            z: -12,
            silent: true,
        });

        const yAxis = getYAxis(coordSys);
        const yExt = yAxis.scale.getExtent();
        const yMid = (yExt[0] + yExt[1]) / 2;
        const axisLineY = getGridBottomY(coordSys);
        const plotArea = getGridArea(coordSys);
        const EDGE_PAD = 16;

        for (const c of changeDates) {
            const catIdx = dates.indexOf(c.date);
            if (catIdx === -1) continue;

            const x = coordSys.dataToPoint([catIdx, yMid])[0];
            if (!Number.isFinite(x)) {
                continue;
            }
            if (
                plotArea &&
                (x < plotArea.x - EDGE_PAD || x > plotArea.x + plotArea.width + EDGE_PAD)
            ) {
                continue;
            }

            const icons = [];
            if (c.templateChanged && this._prefs.iconTemplate) icons.push('template');
            if (c.textChanged && this._prefs.iconText) icons.push(c.headlinesChanged ? 'headlines' : 'text');
            if (c.metaChanged && this._prefs.iconMeta) icons.push(c.titleChanged ? 'title' : 'meta');
            if (icons.length === 0) continue;

            const totalW = icons.length * S + (icons.length - 1) * GAP;
            let sx = x - totalW / 2;

            for (const type of icons) {
                const cx = sx + S / 2;
                const cy = axisLineY + S / 2 + MARGIN_BELOW_AXIS;
                const h = S / 2;
                const dateFrom = c.previousSnapshotDate ?? dates[0];
                const dateTo = c.date;
                const tipText = [
                    'between',
                    dateFrom + ' -',
                    dateTo,
                    LABELS[type],
                ].join('\n');
                const children = [];

                children.push({
                    type: 'rect',
                    shape: { x: cx - h - 2, y: cy - h - 2, width: S + 4, height: S + 4 },
                    style: { fill: 'transparent' },
                    z: 102,
                    onmouseover: function () {
                        tooltipDiv.textContent = '';
                        tipText.split('\n').forEach(function (line, i) {
                            if (i > 0) tooltipDiv.appendChild(document.createElement('br'));
                            tooltipDiv.appendChild(document.createTextNode(line));
                        });
                        tooltipDiv.style.opacity = '0';
                        tooltipDiv.style.left = '0px';
                        tooltipDiv.style.top = '0px';
                        tooltipDiv.style.display = 'block';

                        let leftIdx = c.previousSnapshotDate
                            ? findCategoryIndexForDate(
                                  c.previousSnapshotDate,
                                  dates,
                                  granularity,
                              )
                            : 0;
                        let rightIdx = catIdx;
                        if (leftIdx > rightIdx) {
                            const t = leftIdx;
                            leftIdx = rightIdx;
                            rightIdx = t;
                        }
                        const bandShape = getUncertaintyBandPixelRect(
                            coordSys,
                            leftIdx,
                            rightIdx,
                            dates.length,
                        );
                        chart.setOption({
                            graphic: [
                                {
                                    id: 'change-uncertainty-band',
                                    ignore: false,
                                    shape: bandShape,
                                    style: { fill: BAND_FILL },
                                },
                            ],
                        });

                        requestAnimationFrame(function () {
                            const tipW = tooltipDiv.offsetWidth;
                            const tipH = tooltipDiv.offsetHeight;
                            let left = cx - tipW / 2;
                            if (left + tipW > containerW - 4) left = containerW - tipW - 4;
                            if (left < 4) left = 4;
                            const top = cy - h - tipH - 8;
                            tooltipDiv.style.left = left + 'px';
                            tooltipDiv.style.top = top + 'px';
                            tooltipDiv.style.opacity = '1';
                        });
                    },
                    onmouseout: function () {
                        tooltipDiv.style.opacity = '0';
                        chart.setOption({
                            graphic: [
                                {
                                    id: 'change-uncertainty-band',
                                    ignore: true,
                                },
                            ],
                        });
                    },
                });

                if (type === 'template') {
                    children.push(
                        { type: 'rect', shape: { x: cx - h, y: cy - h, width: S, height: S, r: 1 }, style: { fill: 'none', stroke: GREEN, lineWidth: 1 }, z: 100 },
                        { type: 'line', shape: { x1: cx - h, y1: cy - h + S * 0.31, x2: cx + h, y2: cy - h + S * 0.31 }, style: { stroke: GREEN, lineWidth: 1 }, z: 100 },
                        { type: 'line', shape: { x1: cx - h + S * 0.31, y1: cy - h + S * 0.31, x2: cx - h + S * 0.31, y2: cy + h }, style: { stroke: GREEN, lineWidth: 1 }, z: 100 },
                    );
                } else if (type === 'text') {
                    children.push(
                        { type: 'rect', shape: { x: cx - h, y: cy - h, width: S, height: S, r: 1 }, style: { fill: 'none', stroke: GREEN, lineWidth: 1 }, z: 100 },
                        { type: 'line', shape: { x1: cx - h + 2.5, y1: cy - 2.5, x2: cx + h - 2.5, y2: cy - 2.5 }, style: { stroke: GREEN, lineWidth: 1 }, z: 100 },
                        { type: 'line', shape: { x1: cx - h + 2.5, y1: cy, x2: cx + h - 3.5, y2: cy }, style: { stroke: GREEN, lineWidth: 1 }, z: 100 },
                        { type: 'line', shape: { x1: cx - h + 2.5, y1: cy + 2.5, x2: cx + h - 4.5, y2: cy + 2.5 }, style: { stroke: GREEN, lineWidth: 1 }, z: 100 },
                    );
                } else if (type === 'headlines') {
                    children.push(
                        { type: 'rect', shape: { x: cx - h, y: cy - h, width: S, height: S, r: 1 }, style: { fill: GREEN, stroke: 'none' }, z: 100 },
                        { type: 'rect', shape: { x: cx - h + 2, y: cy - 3, width: S - 4, height: 1.8, r: 0.3 }, style: { fill: BG, stroke: 'none' }, z: 101 },
                        { type: 'rect', shape: { x: cx - h + 2, y: cy - 0.5, width: S - 5.5, height: 1.4, r: 0.3 }, style: { fill: BG, stroke: 'none' }, z: 101 },
                        { type: 'rect', shape: { x: cx - h + 2, y: cy + 2, width: S - 7, height: 1.4, r: 0.3 }, style: { fill: BG, stroke: 'none' }, z: 101 },
                    );
                } else if (type === 'meta') {
                    children.push(
                        { type: 'circle', shape: { cx, cy, r: h - 0.5 }, style: { fill: 'none', stroke: GREEN, lineWidth: 1 }, z: 100 },
                        { type: 'polyline', shape: { points: [[cx - 2.5, cy - 2.5], [cx, cy], [cx - 2.5, cy + 2.5]] }, style: { fill: 'none', stroke: GREEN, lineWidth: 1 }, z: 100 },
                        { type: 'line', shape: { x1: cx + 0.5, y1: cy + 2.5, x2: cx + 3, y2: cy + 2.5 }, style: { stroke: GREEN, lineWidth: 1 }, z: 100 },
                    );
                } else if (type === 'title') {
                    children.push(
                        { type: 'circle', shape: { cx, cy, r: h - 0.5 }, style: { fill: GREEN, stroke: 'none' }, z: 100 },
                        { type: 'polyline', shape: { points: [[cx - 2.5, cy - 2.5], [cx, cy], [cx - 2.5, cy + 2.5]] }, style: { fill: 'none', stroke: BG, lineWidth: 1.2 }, z: 101 },
                        { type: 'line', shape: { x1: cx + 0.5, y1: cy + 2.5, x2: cx + 3, y2: cy + 2.5 }, style: { stroke: BG, lineWidth: 1.2 }, z: 101 },
                    );
                }

                elements.push({ type: 'group', children, z: 100 });
                sx += S + GAP;
            }
        }

        this._chart.setOption({ graphic: elements }, { replaceMerge: ['graphic'] });
    }

    render() {
        if (!this._connected) {
            return html`
                <provider-connect
                    @provider-connected=${this._handleProviderConnected}
                ></provider-connect>
            `;
        }

        const g = this._prefs.granularity || 'daily';
        return html`
            <div class="h-full flex flex-col">
                <!-- Icon type toggles -->
                <div class="flex items-center gap-2 mb-2 flex-wrap">
                    <span class="text-xs text-text-muted shrink-0 w-14">Changes:</span>
                    ${this._renderIconToggle('template', 'Template')}
                    ${this._renderIconToggle('text', 'Text')}
                    ${this._renderIconToggle('meta', 'Meta')}
                </div>

                <!-- Metric toggles + period -->
                <div class="flex items-center justify-between gap-4 mb-4 flex-wrap">
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-text-muted shrink-0 w-14">Metrics:</span>
                        ${this._renderToggle('clicks', 'Clicks', 'bg-[#60a5fa]/20 text-[#60a5fa]')}
                        ${this._renderToggle('impressions', 'Impressions', 'bg-[#a78bfa]/20 text-[#a78bfa]')}
                        ${this._renderToggle('position', 'Position', 'bg-[#fb923c]/20 text-[#fb923c]')}
                    </div>
                    <div class="flex items-center gap-2">
                        <label class="text-xs text-text-muted" for="chart-granularity">Period:</label>
                        <select
                            id="chart-granularity"
                            class="bg-surface-2 border border-neutral-700 text-text-secondary text-xs rounded-md px-2 py-1 pr-8 cursor-pointer max-w-[11rem]"
                            .value=${g}
                            @change=${(e) => this._onGranularityChange(e)}
                        >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>
                </div>

                ${this._analyticsLoading
                    ? html`
                        <div class="flex-1 flex flex-col items-center justify-center text-center px-8">
                            <svg class="text-text-muted mb-4 animate-spin" width="28" height="28"
                                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                            </svg>
                            <p class="text-sm text-text-muted">Loading Search Console data…</p>
                        </div>`
                    : this._analyticsError
                    ? html`
                        <div class="flex-1 flex flex-col items-center justify-center text-center px-8">
                            <div class="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center
                                        justify-center mb-4">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                     stroke="currentColor" stroke-width="1.5" class="text-amber-400">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                            </div>
                            <h3 class="text-sm font-medium text-text-secondary mb-1">
                                Unable to load analytics
                            </h3>
                            <p class="text-xs text-text-muted max-w-[320px]">
                                ${this._analyticsError}
                            </p>
                        </div>`
                    : this._analyticsData.length === 0
                    ? html`
                        <div class="flex-1 flex flex-col items-center justify-center text-center px-8">
                            <div class="w-12 h-12 rounded-xl bg-surface-2 flex items-center
                                        justify-center mb-4">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                     stroke="currentColor" stroke-width="1.5" class="text-text-muted">
                                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                </svg>
                            </div>
                            <h3 class="text-sm font-medium text-text-secondary mb-1">
                                No analytics data
                            </h3>
                            <p class="text-xs text-text-muted max-w-[320px]">
                                No data for this URL in the selected GSC property, or no traffic
                                in the last 18 months. Use the app menu to pick the right property.
                            </p>
                        </div>`
                    : html`<div id="analytics-chart-container" class="flex-1 min-h-[300px]"></div>`
                }
            </div>
        `;
    }

    _renderToggle(metric, label, activeClasses) {
        const active = this._prefs[metric];
        return html`
            <button
                class="px-3 py-1 text-xs rounded-md transition-colors cursor-pointer
                       ${active ? activeClasses : 'bg-surface-2 text-text-muted hover:text-text-secondary'}"
                @click=${() => this._toggleMetric(metric)}
            >${label}</button>
        `;
    }

    _renderIconToggle(iconType, label) {
        const key = 'icon' + iconType.charAt(0).toUpperCase() + iconType.slice(1);
        const active = this._prefs[key];
        const color = active ? '#34d399' : '#737373';
        return html`
            <button
                class="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md
                       transition-colors cursor-pointer
                       ${active
                           ? 'bg-emerald-400/15'
                           : 'bg-surface-2 hover:bg-surface-2/80'}"
                style="color: ${color}"
                @click=${() => this._toggleIcon(iconType)}
            >${this._iconSvg(iconType, active)} ${label}</button>
        `;
    }

    _iconSvg(type, active) {
        if (type === 'template') {
            return html`<svg width="12" height="12" viewBox="0 0 12 12">
                <rect x="0.5" y="0.5" width="11" height="11" rx="1"
                      fill="none" stroke="currentColor" stroke-width="1"/>
                <line x1="0.5" y1="3.7" x2="11.5" y2="3.7"
                      stroke="currentColor" stroke-width="0.8"/>
                <line x1="3.7" y1="3.7" x2="3.7" y2="11.5"
                      stroke="currentColor" stroke-width="0.8"/>
            </svg>`;
        }
        if (type === 'text') {
            return html`<svg width="12" height="12" viewBox="0 0 12 12">
                <rect x="0.5" y="0.5" width="11" height="11" rx="1"
                      fill="none" stroke="currentColor" stroke-width="1"/>
                <line x1="2.5" y1="4" x2="9.5" y2="4"
                      stroke="currentColor" stroke-width="0.8"/>
                <line x1="2.5" y1="6" x2="8.5" y2="6"
                      stroke="currentColor" stroke-width="0.8"/>
                <line x1="2.5" y1="8" x2="7.5" y2="8"
                      stroke="currentColor" stroke-width="0.8"/>
            </svg>`;
        }
        if (type === 'meta') {
            return html`<svg width="12" height="12" viewBox="0 0 12 12">
                <circle cx="6" cy="6" r="5"
                        fill="none" stroke="currentColor" stroke-width="1"/>
                <polyline points="4.5,3.5 7,6 4.5,8.5"
                          fill="none" stroke="currentColor" stroke-width="1"/>
                <line x1="7.5" y1="8.5" x2="9.5" y2="8.5"
                      stroke="currentColor" stroke-width="0.8"/>
            </svg>`;
        }
        return html``;
    }
}


customElements.define('analytics-chart', AnalyticsChart);
