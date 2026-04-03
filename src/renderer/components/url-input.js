import { LitElement, html } from 'lit';

export class UrlInput extends LitElement {
    static properties = {
        value: { type: String },
        syncing: { type: Boolean },
        progress: { type: Object },
        _dropdownOpen: { state: true },
        _allUrls: { state: true },
        _filterText: { state: true },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.value = '';
        this.syncing = false;
        this.progress = null;
        this._dropdownOpen = false;
        this._allUrls = [];
        this._filterText = '';
        this._onDocClick = this._onDocClick.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        document.addEventListener('click', this._onDocClick, true);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('click', this._onDocClick, true);
    }

    _onDocClick(e) {
        if (this._dropdownOpen && !this.contains(e.target)) {
            this._dropdownOpen = false;
        }
    }

    async _handleFocus() {
        this._allUrls = await window.api.getAllUrls();
        this._filterText = '';
        this._dropdownOpen = true;
    }

    _handleInput(e) {
        this._filterText = e.target.value;
        if (!this._dropdownOpen && this._filterText) {
            this._dropdownOpen = true;
        }
    }

    _handleKeyDown(e) {
        if (e.key === 'Enter') {
            this._dropdownOpen = false;
            this._submit(e.target.value.trim());
        }
        if (e.key === 'Escape') {
            this._dropdownOpen = false;
        }
    }

    _handleBlur(e) {
        const val = e.target.value.trim();
        if (val && val !== this.value) {
            this._submit(val);
        }
    }

    _selectUrl(url) {
        this._dropdownOpen = false;
        const input = this.querySelector('input[type="text"]');
        if (input) input.value = url;
        this._submit(url);
    }

    _submit(url) {
        if (!url) return;
        this.dispatchEvent(new CustomEvent('url-changed', {
            detail: { url },
            bubbles: true,
            composed: true,
        }));
    }

    _handleSyncClick() {
        if (this.syncing) return;
        this.dispatchEvent(new CustomEvent('sync-requested', {
            bubbles: true,
            composed: true,
        }));
    }

    _getFilteredUrls() {
        const q = this._filterText.toLowerCase().trim();
        if (!q) return this._allUrls;
        return this._allUrls.filter(function (item) {
            return item.url.toLowerCase().includes(q);
        });
    }

    render() {
        const filtered = this._getFilteredUrls();

        return html`
            <div class="relative flex items-center gap-2 px-4 h-12 bg-surface-0 border-b border-surface-3
                        app-region-drag flex-shrink-0">
                <div class="app-region-no-drag flex items-center gap-2 flex-1 relative">
                    <svg class="text-text-muted flex-shrink-0" width="16" height="16" viewBox="0 0 24 24"
                         fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10A15.3 15.3 0 0112 2" />
                    </svg>
                    <input
                        type="text"
                        .value=${this.value}
                        placeholder="Enter a URL to analyze..."
                        class="flex-1 bg-surface-2 text-text-primary text-sm rounded-md
                               px-3 py-1.5 border border-surface-3
                               placeholder:text-text-muted
                               focus:outline-none focus:ring-1 focus:ring-accent-green/50"
                        @focus=${this._handleFocus}
                        @input=${this._handleInput}
                        @keydown=${this._handleKeyDown}
                    />

                    ${this._dropdownOpen && filtered.length > 0
                        ? html`
                            <div class="absolute left-6 right-[90px] top-[38px] z-50
                                        bg-surface-2 border border-surface-3 rounded-lg shadow-lg
                                        max-h-[320px] overflow-y-auto">
                                ${filtered.map((item) => html`
                                    <button
                                        class="w-full text-left px-3 py-2 text-sm text-text-primary
                                               hover:bg-surface-3 cursor-pointer flex items-center
                                               justify-between gap-2 transition-colors"
                                        @mousedown=${(e) => { e.preventDefault(); this._selectUrl(item.url); }}
                                    >
                                        <span class="truncate ${item.url === this.value ? 'text-accent-green' : ''}"
                                        >${item.url}</span>
                                        <span class="text-[11px] text-text-muted flex-shrink-0"
                                        >${item.count}</span>
                                    </button>
                                `)}
                            </div>
                        `
                        : ''
                    }

                    <button
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                               transition-colors duration-150 flex-shrink-0
                               ${this.syncing
                                   ? 'bg-surface-3 text-text-muted cursor-wait'
                                   : 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30 cursor-pointer'
                               }"
                        @click=${this._handleSyncClick}
                        ?disabled=${this.syncing}
                    >
                        ${this.syncing
                            ? html`
                                <svg class="animate-spin" width="14" height="14" viewBox="0 0 24 24"
                                     fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                                </svg>
                                <span>${this.progress?.current ?? 0} / ${this.progress?.total ?? 0}</span>
                            `
                            : html`
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                     stroke="currentColor" stroke-width="2">
                                    <path d="M23 4v6h-6M1 20v-6h6" />
                                    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                                </svg>
                                <span>Sync</span>
                            `
                        }
                    </button>
                </div>
            </div>
        `;
    }
}


customElements.define('url-input', UrlInput);
