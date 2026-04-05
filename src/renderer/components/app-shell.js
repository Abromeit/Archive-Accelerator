import { LitElement, html } from 'lit';
import * as dataService from '../services/data-service.js';

export class AppShell extends LitElement {
    static properties = {
        currentUrl: { type: String },
        snapshots: { type: Array },
        selectedSnapshot: { type: Object },
        comparisonSnapshot: { type: Object },
        pageInfo: { type: Object },
        activeTab: { type: Number },
        hasData: { type: Boolean },
        _syncing: { state: true },
        _syncProgress: { state: true },
        _filter: { state: true },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.currentUrl = 'https://example.com/products/widget-pro';
        this.snapshots = [];
        this.selectedSnapshot = null;
        this.comparisonSnapshot = null;
        this.pageInfo = null;
        this.activeTab = 0;
        this.hasData = false;
        this._syncing = false;
        this._syncProgress = null;
        this._filter = 'all';
    }

    connectedCallback() {
        super.connectedCallback();
        this._loadData(this.currentUrl);
    }

    async _loadData(url) {
        this.currentUrl = url;
        const [snaps, info] = await Promise.all([
            dataService.getSnapshots(url),
            dataService.getPageInfo(url),
        ]);

        this.snapshots = snaps;
        this.pageInfo = info;
        this.hasData = snaps.length > 0;

        if (snaps.length > 0) {
            this._selectSnapshot(snaps[0]);
        } else {
            this.selectedSnapshot = null;
            this.comparisonSnapshot = null;
        }
    }

    _selectSnapshot(snapshot) {
        this.selectedSnapshot = snapshot;
        this._updateComparisonSnapshot();
    }

    _updateComparisonSnapshot() {
        if (!this.selectedSnapshot) {
            this.comparisonSnapshot = null;
            return;
        }

        const filtered = this._getFilteredSnapshots();
        const idx = filtered.findIndex((s) => s.id === this.selectedSnapshot.id);
        const fullIdx = this.snapshots.findIndex((s) => s.id === this.selectedSnapshot.id);

        if (idx < 0 || fullIdx < 0) {
            this.comparisonSnapshot = null;
            return;
        }

        if (idx < filtered.length - 1) {
            this.comparisonSnapshot = filtered[idx + 1];
            return;
        }

        // Last row in the current filter: compare to the chronologically older snapshot
        // (full list), not only the next matching row — otherwise SERP/diff show no peer.
        if (fullIdx < this.snapshots.length - 1) {
            this.comparisonSnapshot = this.snapshots[fullIdx + 1];
            return;
        }

        this.comparisonSnapshot = null;
    }

    _getFilteredSnapshots() {
        if (this._filter === 'all') return this.snapshots;

        const predicates = {
            template: (s) => s.templateChanged,
            text: (s) => s.textChanged,
            headlines: (s) => s.headlinesChanged,
            meta: (s) => s.metaChanged,
            title: (s) => s.titleChanged,
        };

        return this.snapshots.filter(predicates[this._filter] || (() => true));
    }

    _handleUrlChanged(e) {
        this._loadData(e.detail.url);
    }

    _handleSnapshotSelected(e) {
        this._selectSnapshot(e.detail.snapshot);
    }

    _handleTabChanged(e) {
        this.activeTab = e.detail.index;
    }

    _handleFilterChanged(e) {
        this._filter = e.detail.filter;
        this._updateComparisonSnapshot();
    }

    async _handleDeleteUrl() {
        if (!this.currentUrl) return;
        const confirmed = await window.api.confirmDeleteSnapshots(
            this.currentUrl,
            this.pageInfo?.documentCount ?? 0
        );
        if (!confirmed) return;

        await window.api.deleteSnapshotsForUrl(this.currentUrl);
        this._loadData(this.currentUrl);
    }

    _handleSyncComplete() {
        this._loadData(this.currentUrl);
    }

    async _handleSyncRequested() {
        if (this._syncing || !this.currentUrl) return;
        this._syncing = true;
        this._syncProgress = { current: 0, total: 0, done: false };

        await dataService.syncUrl(this.currentUrl, (p) => {
            this._syncProgress = { ...p };
        });

        this._syncing = false;
        this._syncProgress = null;
        this._loadData(this.currentUrl);
    }

    render() {
        return html`
            <div class="grid grid-cols-[280px_1fr] h-screen">
                <sidebar-panel
                    .snapshots=${this.snapshots}
                    .pageInfo=${this.pageInfo}
                    .selectedSnapshotId=${this.selectedSnapshot?.id}
                    .currentUrl=${this.currentUrl}
                    @snapshot-selected=${this._handleSnapshotSelected}
                    @sync-complete=${this._handleSyncComplete}
                    @filter-changed=${this._handleFilterChanged}
                    @delete-url-requested=${this._handleDeleteUrl}
                ></sidebar-panel>

                <div class="flex flex-col h-screen overflow-hidden" style="background: #1F1F1F">
                    <url-input
                        .value=${this.currentUrl}
                        .syncing=${this._syncing}
                        .progress=${this._syncProgress}
                        @url-changed=${this._handleUrlChanged}
                        @sync-requested=${this._handleSyncRequested}
                    ></url-input>

                    ${this.hasData
                        ? html`
                            <tab-navigation
                                .activeTab=${this.activeTab}
                                @tab-changed=${this._handleTabChanged}
                            ></tab-navigation>

                            <div class="flex-1 overflow-auto p-4">
                                ${this._renderActiveTab()}
                            </div>
                        `
                        : html`<empty-state></empty-state>`
                    }
                </div>
            </div>
        `;
    }

    _renderActiveTab() {
        switch (this.activeTab) {
            case 0:
                return html`
                    <html-viewer
                        .snapshot=${this.selectedSnapshot}
                    ></html-viewer>
                `;
            case 1:
                return html`
                    <diff-viewer
                        .snapshot=${this.selectedSnapshot}
                        .comparisonSnapshot=${this.comparisonSnapshot}
                        .liveSnapshot=${this.snapshots[0]}
                    ></diff-viewer>
                `;
            case 2:
                return html`
                    <serp-preview
                        .snapshot=${this.selectedSnapshot}
                        .comparisonSnapshot=${this.comparisonSnapshot}
                        .liveSnapshot=${this.snapshots[0]}
                    ></serp-preview>
                `;
            case 3:
                return html`
                    <analytics-chart
                        .currentUrl=${this.currentUrl}
                        .snapshots=${this.snapshots}
                    ></analytics-chart>
                `;
            default:
                return html``;
        }
    }
}


customElements.define('app-shell', AppShell);
