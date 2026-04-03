import { LitElement, html } from 'lit';
import { getSnapshotContent } from '../services/data-service.js';

export class HtmlViewer extends LitElement {
    static properties = {
        snapshot: { type: Object },
        _htmlContent: { state: true },
        _loading: { state: true },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.snapshot = null;
        this._htmlContent = null;
        this._loading = false;
        this._loadedId = null;
    }

    updated(changed) {
        if (changed.has('snapshot')) {
            this._loadContent();
        }
    }

    async _loadContent() {
        if (!this.snapshot || this.snapshot.id === this._loadedId) return;

        this._loading = true;
        this._htmlContent = null;
        this._loadedId = this.snapshot.id;

        try {
            const content = await getSnapshotContent(this.snapshot.id);
            if (this._loadedId === this.snapshot.id) {
                this._htmlContent = content;
            }
        } catch (err) {
            console.error('Failed to load snapshot HTML:', err);
        } finally {
            this._loading = false;
        }
    }

    render() {
        if (!this.snapshot) {
            return html`
                <div class="flex items-center justify-center h-full text-text-muted text-sm">
                    Select a snapshot to view its HTML content
                </div>
            `;
        }

        if (this._loading) {
            return html`
                <div class="h-full flex flex-col">
                    <div class="text-xs text-text-muted mb-3">
                        Snapshot from ${this.snapshot.date}
                    </div>
                    <div class="flex items-center justify-center flex-1 text-text-muted text-sm">
                        Loading...
                    </div>
                </div>
            `;
        }

        const iframeContent = `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #e5e5e5;
            background: #1a1a1a;
            padding: 16px;
            line-height: 1.6;
            margin: 0;
        }
        a { color: #60a5fa; }
        h1, h2, h3, h4, h5, h6 { color: #f5f5f5; }
    </style>
</head>
<body>${this._htmlContent || ''}</body>
</html>`;

        return html`
            <div class="h-full flex flex-col">
                <div class="text-xs text-text-muted mb-3">
                    Snapshot from ${this.snapshot.date}
                </div>
                <iframe
                    class="flex-1 w-full rounded-lg border border-surface-3 bg-surface-1"
                    .srcdoc=${iframeContent}
                    sandbox="allow-same-origin"
                ></iframe>
            </div>
        `;
    }
}


customElements.define('html-viewer', HtmlViewer);
