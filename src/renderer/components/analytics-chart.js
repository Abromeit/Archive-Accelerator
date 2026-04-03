import { LitElement, html } from 'lit';
import * as echarts from 'echarts';
import * as dataService from '../services/data-service.js';

export class AnalyticsChart extends LitElement {
    static properties = {
        currentUrl: { type: String },
        snapshots: { type: Array },
        _connected: { type: Boolean, state: true },
        _prefs: { type: Object, state: true },
        _analyticsData: { type: Array, state: true },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.currentUrl = '';
        this.snapshots = [];
        this._connected = false;
        this._prefs = dataService.getChartPreferences();
        this._analyticsData = [];
        this._chart = null;
        this._resizeObserver = null;
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
        if (changed.has('_analyticsData') || changed.has('_prefs') || changed.has('snapshots')) {
            this._updateChart();
        }
    }

    _checkConnection() {
        const providers = dataService.getConnectedProviders();
        this._connected = providers.some((p) => p.connected);
    }

    async _loadData() {
        if (!this._connected || !this.currentUrl) {
            this._analyticsData = [];
            return;
        }
        this._analyticsData = await dataService.getAnalyticsData(this.currentUrl);
    }

    _toggleMetric(metric) {
        this._prefs = { ...this._prefs, [metric]: !this._prefs[metric] };
        dataService.setChartPreferences(this._prefs);
    }

    _handleProviderConnected() {
        this._checkConnection();
    }

    _getSnapshotChanges() {
        return this.snapshots
            .filter((s) => s.templateChanged || s.textChanged || s.metaChanged)
            .map((s) => ({
                date: s.date,
                templateChanged: s.templateChanged,
                textChanged: s.textChanged,
                headlinesChanged: s.headlinesChanged,
                metaChanged: s.metaChanged,
                titleChanged: s.titleChanged,
            }));
    }

    _initChart() {
        const container = this.querySelector('#analytics-chart-container');
        if (!container) return;

        this._destroyChart();
        this._chart = echarts.init(container, null, { renderer: 'canvas' });

        this._resizeObserver = new ResizeObserver(() => {
            this._chart?.resize();
            this._drawChangeIcons();
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
    }

    _updateChart() {
        if (!this._analyticsData.length) return;

        requestAnimationFrame(() => {
            if (!this._chart) {
                this._initChart();
            }
            if (!this._chart) return;

            const dates = this._analyticsData.map((d) => d.date);
            const changes = this._getSnapshotChanges();

            const markLineData = changes
                .filter((c) => dates.includes(c.date))
                .map((c) => ({
                    xAxis: c.date,
                    label: { show: false },
                    lineStyle: {
                        color: '#737373',
                        type: 'dashed',
                        width: 1,
                    },
                }));

            const series = [];

            if (this._prefs.clicks) {
                series.push({
                    name: 'Clicks',
                    type: 'line',
                    yAxisIndex: 0,
                    data: this._analyticsData.map((d) => d.clicks),
                    smooth: true,
                    symbol: 'none',
                    lineStyle: { color: '#34d399', width: 2 },
                    itemStyle: { color: '#34d399' },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(52, 211, 153, 0.15)' },
                            { offset: 1, color: 'rgba(52, 211, 153, 0)' },
                        ]),
                    },
                    markLine: series.length === 0 ? { data: markLineData, silent: true, symbol: ['none', 'none'] } : undefined,
                });
            }

            if (this._prefs.impressions) {
                series.push({
                    name: 'Impressions',
                    type: 'line',
                    yAxisIndex: 0,
                    data: this._analyticsData.map((d) => d.impressions),
                    smooth: true,
                    symbol: 'none',
                    lineStyle: { color: '#60a5fa', width: 2 },
                    itemStyle: { color: '#60a5fa' },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(96, 165, 250, 0.1)' },
                            { offset: 1, color: 'rgba(96, 165, 250, 0)' },
                        ]),
                    },
                    markLine: series.length === 0 ? { data: markLineData, silent: true, symbol: ['none', 'none'] } : undefined,
                });
            }

            if (this._prefs.position) {
                series.push({
                    name: 'Position',
                    type: 'line',
                    yAxisIndex: 1,
                    data: this._analyticsData.map((d) => d.position),
                    smooth: true,
                    symbol: 'none',
                    lineStyle: { color: '#fbbf24', width: 2 },
                    itemStyle: { color: '#fbbf24' },
                    markLine: series.length === 0 ? { data: markLineData, silent: true, symbol: ['none', 'none'] } : undefined,
                });
            }

            if (series.length > 0 && !series.some((s) => s.markLine)) {
                series[0].markLine = { data: markLineData, silent: true, symbol: ['none', 'none'] };
            }

            const changeDates = changes.filter((c) => dates.includes(c.date));
            this._pendingChangeIcons = changeDates.length > 0 ? { changeDates, dates } : null;

            const option = {
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
                    right: this._prefs.position ? 60 : 20,
                    bottom: 70,
                    left: 60,
                },
                xAxis: {
                    type: 'category',
                    data: dates,
                    axisLine: { lineStyle: { color: '#404040' } },
                    axisLabel: {
                        color: '#737373',
                        fontSize: 10,
                        formatter: (val) => val,
                    },
                    axisTick: { show: false },
                },
                yAxis: [
                    {
                        type: 'value',
                        name: 'Clicks / Impressions',
                        nameTextStyle: { color: '#737373', fontSize: 10 },
                        axisLine: { show: false },
                        axisLabel: { color: '#737373', fontSize: 10 },
                        splitLine: { lineStyle: { color: '#262626' } },
                        min: 0,
                    },
                    {
                        type: 'value',
                        name: 'Position',
                        nameTextStyle: { color: '#737373', fontSize: 10 },
                        axisLine: { show: false },
                        axisLabel: { color: '#737373', fontSize: 10 },
                        splitLine: { show: false },
                        inverse: true,
                        min: 1,
                    },
                ],
                series,
            };

            this._chart.setOption(option, true);
            this._drawChangeIcons();
        });
    }

    _drawChangeIcons() {
        if (!this._chart || !this._pendingChangeIcons) {
            this._chart?.setOption({ graphic: [] }, { replaceMerge: ['graphic'] });
            return;
        }

        const { changeDates, dates } = this._pendingChangeIcons;
        const coordSys = this._chart.getModel().getSeriesByIndex(0)?.coordinateSystem;
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

        for (const c of changeDates) {
            const catIdx = dates.indexOf(c.date);
            if (catIdx === -1) continue;

            const pt = coordSys.dataToPoint([catIdx, 0]);
            const x = pt[0];
            const baseY = pt[1];

            const icons = [];
            if (c.templateChanged) icons.push('template');
            if (c.textChanged) icons.push(c.headlinesChanged ? 'headlines' : 'text');
            if (c.metaChanged) icons.push(c.titleChanged ? 'title' : 'meta');

            const totalW = icons.length * S + (icons.length - 1) * GAP;
            let sx = x - totalW / 2;
            const iconYOffset = 24;

            for (const type of icons) {
                const cx = sx + S / 2;
                const cy = baseY + S / 2 + iconYOffset;
                const h = S / 2;
                const tipText = `${c.date}\n${LABELS[type]}`;
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

        return html`
            <div class="h-full flex flex-col">
                <!-- Metric toggles -->
                <div class="flex items-center gap-2 mb-4">
                    <span class="text-xs text-text-muted mr-2">Metrics:</span>
                    ${this._renderToggle('clicks', 'Clicks', 'bg-accent-green/20 text-accent-green')}
                    ${this._renderToggle('impressions', 'Impressions', 'bg-accent-blue/20 text-accent-blue')}
                    ${this._renderToggle('position', 'Position', 'bg-accent-amber/20 text-accent-amber')}
                </div>

                <!-- Chart container -->
                <div id="analytics-chart-container" class="flex-1 min-h-[300px]"></div>
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
}


customElements.define('analytics-chart', AnalyticsChart);
