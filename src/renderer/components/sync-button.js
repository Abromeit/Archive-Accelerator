import { LitElement, html } from 'lit';
import * as dataService from '../services/data-service.js';

export class SyncButton extends LitElement {
    static properties = {
        currentUrl: { type: String },
        syncing: { type: Boolean },
        progress: { type: Object },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.currentUrl = '';
        this.syncing = false;
        this.progress = null;
    }

    async _handleSync() {
        if (this.syncing || !this.currentUrl) return;
        this.syncing = true;
        this.progress = { current: 0, total: 0, done: false };

        await dataService.syncUrl(this.currentUrl, (p) => {
            this.progress = { ...p };
        });

        this.syncing = false;
        this.progress = null;

        this.dispatchEvent(new CustomEvent('sync-complete', {
            bubbles: true,
            composed: true,
        }));
    }

    render() {
        return html`
            <button
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
                       transition-colors duration-150
                       ${this.syncing
                           ? 'bg-surface-3 text-text-muted cursor-wait'
                           : 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30 cursor-pointer'
                       }"
                @click=${this._handleSync}
                ?disabled=${this.syncing}
            >
                ${this.syncing
                    ? html`
                        <svg class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
                        <span>${this.progress?.current ?? 0} / ${this.progress?.total ?? 0}</span>
                    `
                    : html`
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c-1.66 0-3-4.03-3-9s1.34-9 3-9m0 18c1.66 0 3-4.03 3-9s-1.34-9-3-9m-9 9a9 9 0 019-9" />
                        </svg>
                        <span>Sync</span>
                    `
                }
            </button>
        `;
    }
}


customElements.define('sync-button', SyncButton);
