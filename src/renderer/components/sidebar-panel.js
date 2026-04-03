import { LitElement, html } from 'lit';

const ICON_ALL = html`<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5.5" x2="15" y2="5.5"/><line x1="1" y1="10.5" x2="15" y2="10.5"/></svg>`;
const ICON_TMPL = html`<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5.5" x2="15" y2="5.5"/><line x1="5.5" y1="5.5" x2="5.5" y2="15"/></svg>`;
const ICON_TEXT = html`<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="0.5" width="14" height="15" rx="1"/><line x1="4" y1="5" x2="12" y2="5"/><line x1="4" y1="8" x2="11" y2="8"/><line x1="4" y1="11" x2="9" y2="11"/></svg>`;
const ICON_HEAD = html`<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" stroke="none"><rect x="1" y="0.5" width="14" height="15" rx="1"/><rect x="3.5" y="4" width="9" height="2" rx="0.5" fill="#0f0f0f"/><rect x="3.5" y="7.5" width="7" height="1.5" rx="0.5" fill="#0f0f0f"/><rect x="3.5" y="10.5" width="5.5" height="1.5" rx="0.5" fill="#0f0f0f"/></svg>`;
const ICON_META = html`<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M5.5 5.5l2.5 2.5-2.5 2.5M9 10.5h2.5"/></svg>`;
const ICON_TITLE = html`<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" stroke="none"><circle cx="8" cy="8" r="6.5"/><path d="M5.5 5.5l2.5 2.5-2.5 2.5" fill="none" stroke="#0f0f0f" stroke-width="1.5"/><line x1="9" y1="10.5" x2="11.5" y2="10.5" stroke="#0f0f0f" stroke-width="1.5"/></svg>`;

const FILTER_OPTIONS = [
    { value: 'all', label: 'All versions', icon: ICON_ALL },
    { value: 'template', label: 'Template changed', icon: ICON_TMPL },
    { value: 'text', label: 'Text changed', icon: ICON_TEXT },
    { value: 'headlines', label: 'Headlines changed', icon: ICON_HEAD },
    { value: 'meta', label: 'Meta changed', icon: ICON_META },
    { value: 'title', label: 'Title changed', icon: ICON_TITLE },
];

export class SidebarPanel extends LitElement {
    static properties = {
        snapshots: { type: Array },
        pageInfo: { type: Object },
        selectedSnapshotId: { type: String },
        currentUrl: { type: String },
        filter: { type: String },
        _filterOpen: { type: Boolean, state: true },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.snapshots = [];
        this.pageInfo = null;
        this.selectedSnapshotId = null;
        this.currentUrl = '';
        this.filter = 'all';
        this._filterOpen = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this._closeOnOutsideClick = (e) => {
            if (this._filterOpen && !e.composedPath().some((el) => el.id === 'filter-dropdown')) {
                this._filterOpen = false;
            }
        };
        document.addEventListener('click', this._closeOnOutsideClick);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('click', this._closeOnOutsideClick);
    }

    _getFilteredSnapshots() {
        if (this.filter === 'all') return this.snapshots;

        const predicates = {
            template: (s) => s.templateChanged,
            text: (s) => s.textChanged,
            headlines: (s) => s.headlinesChanged,
            meta: (s) => s.metaChanged,
            title: (s) => s.titleChanged,
        };

        return this.snapshots.filter(predicates[this.filter] || (() => true));
    }

    _toggleFilter() {
        this._filterOpen = !this._filterOpen;
    }

    _selectFilter(value) {
        this.filter = value;
        this._filterOpen = false;
    }

    _getCurrentFilterOption() {
        return FILTER_OPTIONS.find((o) => o.value === this.filter) || FILTER_OPTIONS[0];
    }

    render() {
        const filtered = this._getFilteredSnapshots();
        const current = this._getCurrentFilterOption();

        return html`
            <div class="flex flex-col h-screen bg-surface-1 border-r border-surface-3">
                <div class="h-12 flex-shrink-0 app-region-drag"></div>

                ${this.pageInfo
                    ? html`
                        <div class="px-3 pb-3 flex-shrink-0 border-b border-surface-3">
                            <div class="text-xs text-text-muted mb-1">
                                ${this.pageInfo.documentCount} snapshots
                            </div>
                            <div class="text-xs text-text-muted">
                                ${this.pageInfo.firstDate} — ${this.pageInfo.lastDate}
                            </div>
                        </div>
                    `
                    : html``
                }

                <div class="px-3 py-3 flex-shrink-0 relative" id="filter-dropdown">
                    <button
                        class="w-full flex items-center gap-2 bg-surface-2 text-text-primary text-sm
                               px-2.5 py-1.5 border border-surface-3
                               focus:outline-none focus:ring-1 focus:ring-accent-green/50
                               cursor-pointer transition-colors hover:border-surface-4"
                        @click=${this._toggleFilter}
                    >
                        <span class="text-accent-green">${current.icon}</span>
                        <span class="flex-1 text-left">${current.label}</span>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"
                             class="text-text-muted transition-transform ${this._filterOpen ? 'rotate-180' : ''}">
                            <path d="M3 4.5l3 3 3-3"/>
                        </svg>
                    </button>

                    ${this._filterOpen
                        ? html`
                            <div class="absolute left-3 right-3 top-full mt-1 bg-surface-2 border border-surface-3
                                        shadow-lg shadow-black/40 z-50 overflow-hidden">
                                ${FILTER_OPTIONS.map((opt) => html`
                                    <button
                                        class="w-full flex items-center gap-2 px-2.5 py-2 text-sm
                                               cursor-pointer transition-colors
                                               ${opt.value === this.filter
                                                   ? 'bg-accent-green/10 text-accent-green'
                                                   : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary'
                                               }"
                                        @click=${() => this._selectFilter(opt.value)}
                                    >
                                        <span class="${opt.value === this.filter ? 'text-accent-green' : 'text-text-muted'}">${opt.icon}</span>
                                        <span>${opt.label}</span>
                                    </button>
                                `)}
                            </div>
                        `
                        : html``
                    }
                </div>

                <div class="flex-1 overflow-y-auto px-3 pb-3 scroll-smooth">
                    ${filtered.length === 0
                        ? html`
                            <div class="text-center text-text-muted text-sm py-8">
                                No matching snapshots
                            </div>
                        `
                        : filtered.map((snap) => html`
                            <snapshot-card
                                .snapshot=${snap}
                                .selected=${snap.id === this.selectedSnapshotId}
                            ></snapshot-card>
                        `)
                    }
                </div>
            </div>
        `;
    }
}


customElements.define('sidebar-panel', SidebarPanel);
