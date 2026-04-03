import { LitElement, html } from 'lit';

export class HtmlViewer extends LitElement {
    static properties = {
        snapshot: { type: Object },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.snapshot = null;
    }

    render() {
        if (!this.snapshot) {
            return html`
                <div class="flex items-center justify-center h-full text-text-muted text-sm">
                    Select a snapshot to view its HTML content
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
<body>${this.snapshot.htmlContent}</body>
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
