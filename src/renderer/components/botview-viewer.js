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
        _searchQuery: { state: true },
        _matchCount: { state: true },
        _currentMatchIdx: { state: true },
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
        this._searchQuery = '';
        this._matchCount = 0;
        this._currentMatchIdx = -1;
    }

    updated(changed) {
        if (changed.has('snapshot')) {
            this._loadContent();
        }
        if (changed.has('_searchQuery') || changed.has('_content')) {
            this._applySearchAfterRender();
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

    _applySearchAfterRender() {
        const self = this;
        requestAnimationFrame(function applyBvSearch() {
            self._highlightMatches();
        });
    }

    _highlightMatches() {
        const query = this._searchQuery.trim();
        const pre = this.querySelector('.botview-text-pre');
        if (!pre) return;
        this._markTextNodes(pre, query);
    }

    _markTextNodes(root, query) {
        const existing = root.querySelectorAll('mark[data-search]');
        for (let i = existing.length - 1; i >= 0; --i) {
            const mark = existing[i];
            const parent = mark.parentNode;
            while (mark.firstChild) {
                parent.insertBefore(mark.firstChild, mark);
            }
            parent.removeChild(mark);
            parent.normalize();
        }

        if (!query) {
            this._matchCount = 0;
            this._currentMatchIdx = -1;
            return;
        }

        const lowerQuery = query.toLowerCase();
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const matches = [];
        const textNodes = [];

        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        for (let i = 0, i_max = textNodes.length; i < i_max; ++i) {
            const node = textNodes[i];
            const text = node.textContent;
            const lowerText = text.toLowerCase();
            let startPos = 0;

            while (true) {
                const idx = lowerText.indexOf(lowerQuery, startPos);
                if (idx === -1) break;
                matches.push({ node, offset: idx, length: query.length });
                startPos = idx + query.length;
            }
        }

        for (let i = matches.length - 1; i >= 0; --i) {
            const { node, offset, length } = matches[i];
            const range = document.createRange();
            range.setStart(node, offset);
            range.setEnd(node, offset + length);

            const mark = (node.ownerDocument || document).createElement('mark');
            mark.setAttribute('data-search', '');
            mark.style.cssText = 'background: #6b5b00; color: #fff; border-radius: 2px; padding: 0 1px;';
            range.surroundContents(mark);
        }

        this._matchCount = matches.length;
        if (matches.length > 0) {
            this._currentMatchIdx = 0;
            this._scrollToMatch(0, root);
        } else {
            this._currentMatchIdx = -1;
        }
    }

    _scrollToMatch(idx, root) {
        if (!root) {
            root = this.querySelector('.botview-text-pre');
        }
        if (!root) return;

        const marks = root.querySelectorAll('mark[data-search]');
        for (let i = 0, i_max = marks.length; i < i_max; ++i) {
            marks[i].style.background = (i === idx) ? '#c29200' : '#6b5b00';
        }
        if (marks[idx]) {
            marks[idx].scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }

    _handleSearchInput(e) {
        this._searchQuery = e.target.value;
    }

    _handleSearchKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                this._prevMatch();
            } else {
                this._nextMatch();
            }
        }
        if (e.key === 'Escape') {
            this._searchQuery = '';
            e.target.value = '';
        }
    }

    _nextMatch() {
        if (this._matchCount === 0) return;
        this._currentMatchIdx = (this._currentMatchIdx + 1) % this._matchCount;
        this._scrollToMatch(this._currentMatchIdx);
    }

    _prevMatch() {
        if (this._matchCount === 0) return;
        this._currentMatchIdx = (this._currentMatchIdx - 1 + this._matchCount) % this._matchCount;
        this._scrollToMatch(this._currentMatchIdx);
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
                .bv-li { color: #a0a0a0; }
                .bv-a { color: #60a5fa; background: rgba(96, 165, 250, .08); }
                .bv-h { color: #46b478; background: rgba(70, 180, 120, .06); }
                .bv-h1 { color: #46b478; background: rgba(70, 180, 120, .06); font-weight: 700; }
            </style>
            <div class="h-full flex flex-col">
                <div class="flex items-center gap-3 mb-3">
                    <div class="text-xs text-text-muted flex-shrink-0">
                        Snapshot from ${this.snapshot.date}
                    </div>

                    <div class="flex items-center gap-1.5 flex-1 justify-center">
                        <div class="flex items-center bg-surface-2 rounded-md px-2 py-1 gap-1.5
                                    border border-surface-3 focus-within:border-accent-green/50
                                    max-w-[280px] w-full">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                 stroke="currentColor" stroke-width="2" class="text-text-muted flex-shrink-0">
                                <circle cx="11" cy="11" r="8"/>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                            <input
                                type="text"
                                placeholder="Search…"
                                .value=${this._searchQuery}
                                @input=${this._handleSearchInput}
                                @keydown=${this._handleSearchKeydown}
                                class="bg-transparent border-none outline-none text-xs text-text-primary
                                       placeholder:text-text-muted w-full"
                            />
                            ${this._searchQuery
                                ? html`
                                    <span class="text-[10px] text-text-muted flex-shrink-0 tabular-nums">
                                        ${this._matchCount > 0
                                            ? `${this._currentMatchIdx + 1}/${this._matchCount}`
                                            : '0/0'
                                        }
                                    </span>
                                    <button class="text-text-muted hover:text-text-secondary p-0.5 cursor-pointer"
                                            @click=${this._prevMatch} title="Previous (Shift+Enter)">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                                             stroke="currentColor" stroke-width="2.5">
                                            <polyline points="18 15 12 9 6 15"/>
                                        </svg>
                                    </button>
                                    <button class="text-text-muted hover:text-text-secondary p-0.5 cursor-pointer"
                                            @click=${this._nextMatch} title="Next (Enter)">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                                             stroke="currentColor" stroke-width="2.5">
                                            <polyline points="6 9 12 15 18 9"/>
                                        </svg>
                                    </button>
                                `
                                : ''
                            }
                        </div>
                    </div>
                </div>
                <div class="flex-1 overflow-auto rounded-lg border border-surface-3 bg-surface-1">
                    <pre class="botview-text-pre p-4 text-[13px] font-mono leading-relaxed m-0
                                text-text-muted select-text"
                         style="white-space: pre-wrap; word-break: break-word;"
                    >${unsafeHTML(this._getHighlightedHtml())}</pre>
                </div>
            </div>
        `;
    }
}


customElements.define('botview-viewer', BotviewViewer);
