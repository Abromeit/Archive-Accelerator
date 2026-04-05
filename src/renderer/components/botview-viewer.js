import { LitElement, html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { getSnapshotBotview } from '../services/data-service.js';

const RE_HL_STRONG = /(&lt;strong&gt;[\s\S]*?&lt;\/strong&gt;)/gi;
const RE_HL_EM = /(&lt;em&gt;[\s\S]*?&lt;\/em&gt;)/gi;
const RE_HL_IMG = /(&lt;img[\s\S]*?\/&gt;)/gi;
const RE_HL_LI = /(&lt;\/?li&gt;)/gi;
const RE_HL_A = /(&lt;a&gt;[\s\S]*?&lt;\/a&gt;)/gi;
const RE_HL_H1 = /(&lt;h1&gt;[\s\S]*?&lt;\/h1&gt;)/gi;

const RE_HL_H = [];
for (let i = 6; i >= 2; --i) {
    RE_HL_H.push(new RegExp(`(&lt;h${i}&gt;[\\s\\S]*?&lt;\\/h${i}&gt;)`, 'gi'));
}


export class BotviewViewer extends LitElement {
    static properties = {
        snapshot: { type: Object },
        _content: { state: true },
        _loading: { state: true },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.snapshot = null;
        this._content = null;
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
        this._content = null;
        this._loadedId = this.snapshot.id;

        try {
            const content = await getSnapshotBotview(this.snapshot.id);
            if (this._loadedId === this.snapshot.id) {
                this._content = content;
            }
        } catch (err) {
            console.error('Failed to load botview:', err);
        } finally {
            this._loading = false;
        }
    }

    _getHighlightedHtml() {
        if (!this._content) return '';

        let t = this._content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        t = t.replace(RE_HL_STRONG, '<span class="bv-strong">$1</span>');
        t = t.replace(RE_HL_EM, '<span class="bv-em">$1</span>');
        t = t.replace(RE_HL_IMG, '<span class="bv-img">$1</span>');
        t = t.replace(RE_HL_LI, '<span class="bv-li">$1</span>');
        t = t.replace(RE_HL_A, '<span class="bv-a">$1</span>');

        for (let i = 0, i_max = RE_HL_H.length; i < i_max; ++i) {
            t = t.replace(RE_HL_H[i], '<span class="bv-h">$1</span>');
        }
        t = t.replace(RE_HL_H1, '<span class="bv-h1">$1</span>');

        return t;
    }

    render() {
        if (!this.snapshot) {
            return html`
                <div class="flex items-center justify-center h-full text-text-muted text-sm">
                    Select a snapshot to view its text content
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
                        Loading…
                    </div>
                </div>
            `;
        }

        return html`
            <style>
                .bv-strong { color: #e5e5e5; }
                .bv-em { color: #e5e5e5; }
                .bv-img { color: #c084fc; }
                .bv-li { color: #666; }
                .bv-a { color: #60a5fa; background: rgba(96, 165, 250, .08); }
                .bv-h { color: #46b478; background: rgba(70, 180, 120, .06); }
                .bv-h1 { color: #46b478; background: rgba(70, 180, 120, .06); font-weight: 700; }
            </style>
            <div class="h-full flex flex-col">
                <div class="text-xs text-text-muted mb-3">
                    Snapshot from ${this.snapshot.date}
                </div>
                <div class="flex-1 overflow-auto rounded-lg border border-surface-3 bg-surface-1">
                    <pre class="p-4 text-[13px] font-mono leading-relaxed m-0
                                text-text-muted select-text"
                         style="white-space: pre-wrap; word-break: break-word;"
                    >${unsafeHTML(this._getHighlightedHtml())}</pre>
                </div>
            </div>
        `;
    }
}


customElements.define('botview-viewer', BotviewViewer);
