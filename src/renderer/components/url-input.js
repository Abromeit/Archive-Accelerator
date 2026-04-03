import { LitElement, html } from 'lit';

export class UrlInput extends LitElement {
    static properties = {
        value: { type: String },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.value = '';
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
                </div>
            </div>
        `;
    }
}


customElements.define('url-input', UrlInput);
