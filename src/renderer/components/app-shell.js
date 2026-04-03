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
    }

    connectedCallback() {
        super.connectedCallback();
        this._loadData(this.currentUrl);

        if (window.api?.onProviderAction) {
            window.api.onProviderAction((data) => {
                this.dispatchEvent(new CustomEvent('provider-action', {
                    detail: data,
                    bubbles: true,
                    composed: true,
                }));
            });
        }
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
        const idx = this.snapshots.findIndex((s) => s.id === snapshot.id);
        this.comparisonSnapshot = idx < this.snapshots.length - 1 ? this.snapshots[idx + 1] : null;
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

    render() {
        return html`
            <div class="grid grid-cols-[280px_1fr] h-screen">
                <sidebar-panel
                    .snapshots=${this.snapshots}
                    .pageInfo=${this.pageInfo}
                    .selectedSnapshotId=${this.selectedSnapshot?.id}
                    .currentUrl=${this.currentUrl}
                    @snapshot-selected=${this._handleSnapshotSelected}
                ></sidebar-panel>

                <div class="flex flex-col h-screen overflow-hidden" style="background: #1F1F1F">
                    <url-input
                        .value=${this.currentUrl}
                        @url-changed=${this._handleUrlChanged}
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
