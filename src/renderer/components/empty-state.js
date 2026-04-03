import { LitElement, html } from 'lit';

export class EmptyState extends LitElement {
    createRenderRoot() {
        return this;
    }

    render() {
        return html`
            <div class="flex-1 flex flex-col items-center justify-center text-center px-8 py-16">
                <svg class="text-text-muted mb-6" width="64" height="64" viewBox="0 0 24 24"
                     fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                </svg>

                <h2 class="text-lg font-semibold text-text-primary mb-2">
                    No data available
                </h2>
                <p class="text-sm text-text-muted max-w-sm mb-6">
                    There are no archived snapshots for this URL yet.
                    Use the Sync button in the sidebar to download snapshots from archive.org.
                </p>

                <div class="flex items-center gap-2 text-xs text-text-muted bg-surface-2 rounded-lg px-4 py-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>Enter a URL above and click Sync to get started</span>
                </div>
            </div>
        `;
    }
}


customElements.define('empty-state', EmptyState);
