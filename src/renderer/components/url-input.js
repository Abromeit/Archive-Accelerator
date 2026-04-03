import { LitElement, html } from 'lit';

export class UrlInput extends LitElement {
    static properties = {
        value: { type: String },
        syncing: { type: Boolean },
        progress: { type: Object },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.value = '';
        this.syncing = false;
        this.progress = null;
    }

    _handleKeyDown(e) {
        if (e.key === 'Enter') {
            this._submit(e.target.value.trim());
        }
    }

    _handleBlur(e) {
        const val = e.target.value.trim();
        if (val && val !== this.value) {
            this._submit(val);
        }
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

    render() {
        return html`
            <div class="flex items-center gap-2 px-4 h-12 bg-surface-0 border-b border-surface-3
                        app-region-drag flex-shrink-0">
                <div class="app-region-no-drag flex items-center gap-2 flex-1">
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
                        @keydown=${this._handleKeyDown}
                        @blur=${this._handleBlur}
                    />
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
