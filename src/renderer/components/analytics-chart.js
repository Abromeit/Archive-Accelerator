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
                    markLine: series.length === 0 ? { data: markLineData, silent: true } : undefined,
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
                    markLine: series.length === 0 ? { data: markLineData, silent: true } : undefined,
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
                    markLine: series.length === 0 ? { data: markLineData, silent: true } : undefined,
                });
            }

            if (series.length > 0 && !series.some((s) => s.markLine)) {
                series[0].markLine = { data: markLineData, silent: true };
            }

            const changeMarkers = changes
                .filter((c) => dates.includes(c.date))
                .map((c) => {
                    const parts = [];
                    if (c.templateChanged) parts.push('Template');
                    if (c.headlinesChanged) parts.push('Headlines');
                    else if (c.textChanged) parts.push('Text');
                    if (c.titleChanged) parts.push('Title');
                    else if (c.metaChanged) parts.push('Meta');
                    return {
                        coord: [c.date, 0],
                        value: parts.join(', '),
                        symbol: 'diamond',
                        symbolSize: 8,
                        itemStyle: {
                            color: c.templateChanged ? '#fbbf24'
                                : c.headlinesChanged ? '#60a5fa'
                                : c.titleChanged ? '#c084fc'
                                : c.textChanged ? '#60a5fa'
                                : '#c084fc',
                        },
                    };
                });

            if (series.length > 0 && changeMarkers.length > 0) {
                series[0].markPoint = {
                    data: changeMarkers,
                    label: { show: false },
                };
            }

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
                    top: 20,
                    right: this._prefs.position ? 60 : 20,
                    bottom: 40,
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
        });
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
