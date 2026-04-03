import { LitElement, html } from 'lit';
import * as dataService from '../services/data-service.js';

export class ProviderConnect extends LitElement {
    static properties = {
        providers: { type: Array },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.providers = [];
        this._loadProviders();
    }

    async _loadProviders() {
        this.providers = await dataService.getConnectedProviders();
    }

    async _handleConnect(providerId) {
        this.providers = await dataService.connectProvider(providerId);
        this.dispatchEvent(new CustomEvent('provider-connected', {
            detail: { providerId },
            bubbles: true,
            composed: true,
        }));
    }

    render() {
        return html`
            <div class="flex flex-col items-center justify-center h-full text-center px-8">
                <svg class="text-text-muted mb-6" width="56" height="56" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>

                <h2 class="text-lg font-semibold text-text-primary mb-2">
                    Connect a data provider
                </h2>
                <p class="text-sm text-text-muted max-w-md mb-8">
                    Connect your analytics account to view search performance data alongside
                    your archived snapshots.
                </p>

                <div class="flex flex-col gap-4 w-full max-w-sm">
                    ${this.providers.map((provider) => html`
                        <div class="flex items-center justify-between bg-surface-2 rounded-lg
                                    border border-surface-3 px-5 py-4">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-surface-3 flex items-center
                                            justify-center text-text-muted">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                         stroke="currentColor" stroke-width="2">
                                        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                                    </svg>
                                </div>
                                <span class="text-sm font-medium text-text-primary">
                                    ${provider.name}
                                </span>
                            </div>

                            ${provider.connected
                                ? html`
                                    <span class="text-xs text-accent-green bg-accent-green/10
                                                 px-2.5 py-1 rounded-full">
                                        Connected
                                    </span>
                                `
                                : html`
                                    <button
                                        class="px-3 py-1.5 text-xs font-medium rounded-md
                                               bg-white text-neutral-900
                                               hover:bg-neutral-200 transition-colors
                                               cursor-pointer"
                                        @click=${() => this._handleConnect(provider.id)}
                                    >Connect with Google</button>
                                `
                            }
                        </div>
                    `)}
                </div>
            </div>
        `;
    }
}


customElements.define('provider-connect', ProviderConnect);
