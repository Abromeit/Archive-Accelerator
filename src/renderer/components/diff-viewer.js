import { LitElement, html } from 'lit';
import { diffWords } from 'diff';

export class DiffViewer extends LitElement {
    static properties = {
        snapshot: { type: Object },
        comparisonSnapshot: { type: Object },
        liveSnapshot: { type: Object },
        mode: { type: String },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.snapshot = null;
        this.comparisonSnapshot = null;
        this.liveSnapshot = null;
        this.mode = 'previous';
    }

    _getComparisonText() {
        if (this.mode === 'live') {
            return this.liveSnapshot?.plaintext ?? '';
        }
        return this.comparisonSnapshot?.plaintext ?? '';
    }

    _getComparisonLabel() {
        if (this.mode === 'live') {
            return this.liveSnapshot?.date ?? 'Live';
        }
        return this.comparisonSnapshot?.date ?? 'N/A';
    }

    _computeDiff() {
        const oldText = this._getComparisonText();
        const newText = this.snapshot?.plaintext ?? '';
        return diffWords(oldText, newText);
    }

    render() {
        if (!this.snapshot) {
            return html`
                <div class="flex items-center justify-center h-full text-text-muted text-sm">
                    Select a snapshot to view diffs
                </div>
            `;
        }

        const parts = this._computeDiff();
        const hasPrevious = !!this.comparisonSnapshot;

        return html`
            <div class="h-full flex flex-col">
                <div class="flex items-center gap-2 mb-4">
                    <span class="text-xs text-text-muted mr-2">Compare:</span>
                    <button
                        class="px-3 py-1 text-xs rounded-md transition-colors cursor-pointer
                               ${this.mode === 'previous'
                                   ? 'bg-accent-green/20 text-accent-green'
                                   : 'bg-surface-2 text-text-muted hover:text-text-secondary'
                               }"
                        @click=${() => { this.mode = 'previous'; }}
                        ?disabled=${!hasPrevious}
                    >vs Previous</button>
                    <button
                        class="px-3 py-1 text-xs rounded-md transition-colors cursor-pointer
                               ${this.mode === 'live'
                                   ? 'bg-accent-green/20 text-accent-green'
                                   : 'bg-surface-2 text-text-muted hover:text-text-secondary'
                               }"
                        @click=${() => { this.mode = 'live'; }}
                    >vs Live</button>
                </div>

                <div class="text-xs text-text-muted mb-3">
                    ${this.snapshot.date} vs ${this._getComparisonLabel()}
                </div>

                <div class="flex-1 overflow-auto rounded-lg border border-surface-3 bg-surface-1 select-text">
                    <div class="p-4 text-sm leading-relaxed"
                         style="white-space: pre-wrap; word-break: break-word;"
                    >${parts.map(function (part) {
                        if (part.added) {
                            return html`<span style="background: rgba(46, 160, 67, 0.25); color: #7ee787; text-decoration: underline; text-decoration-color: rgba(46, 160, 67, 0.4); text-underline-offset: 2px;">${part.value}</span>`;
                        }
                        if (part.removed) {
                            return html`<span style="background: rgba(248, 81, 73, 0.25); color: #ffa198; text-decoration: line-through; text-decoration-color: rgba(248, 81, 73, 0.4);">${part.value}</span>`;
                        }
                        return html`<span class="text-text-secondary">${part.value}</span>`;
                    })}</div>
                </div>
            </div>
        `;
    }
}


customElements.define('diff-viewer', DiffViewer);
