import { LitElement, html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import hljs from 'highlight.js/lib/core';
import htmlLang from 'highlight.js/lib/languages/xml';
import { getSnapshotContent, getSnapshotBotview } from '../services/data-service.js';

hljs.registerLanguage('html', htmlLang);

const RE_BV_STRONG = /(&lt;strong&gt;[\s\S]*?&lt;\/strong&gt;)/gi;
const RE_BV_EM = /(&lt;em&gt;[\s\S]*?&lt;\/em&gt;)/gi;
const RE_BV_IMG = /(&lt;img[\s\S]*?\/&gt;)/gi;
const RE_BV_LI = /(&lt;\/?li&gt;)/gi;
const RE_BV_A = /(&lt;a&gt;[\s\S]*?&lt;\/a&gt;)/gi;
const RE_BV_H1 = /(&lt;h1&gt;[\s\S]*?&lt;\/h1&gt;)/gi;

const RE_BV_H = [];
for (let i = 6; i >= 2; --i) {
    RE_BV_H.push(new RegExp(`(&lt;h${i}&gt;[\\s\\S]*?&lt;\\/h${i}&gt;)`, 'gi'));
}

export class HtmlViewer extends LitElement {
    static properties = {
        snapshot: { type: Object },
        _htmlContent: { state: true },
        _botviewContent: { state: true },
        _loading: { state: true },
        _viewMode: { state: true },
        _wrapLines: { state: true },
        _searchQuery: { state: true },
        _matchCount: { state: true },
        _currentMatchIdx: { state: true },
        _matchesCapped: { state: true },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.snapshot = null;
        this._htmlContent = null;
        this._botviewContent = null;
        this._loading = false;
        this._loadedId = null;
        this._viewMode = 'text';
        this._wrapLines = false;
        this._searchQuery = '';
        this._matchCount = 0;
        this._currentMatchIdx = -1;
        this._matchesCapped = false;
        this._searchDebounceTimer = null;
        this._boundDocKeydown = null;
        this._iframeShortcutDoc = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._boundDocKeydown = this._onDocumentKeydown.bind(this);
        document.addEventListener('keydown', this._boundDocKeydown, true);
    }

    disconnectedCallback() {
        this._detachIframeSearchShortcuts();
        if (this._boundDocKeydown) {
            document.removeEventListener('keydown', this._boundDocKeydown, true);
            this._boundDocKeydown = null;
        }
        super.disconnectedCallback();
    }

    _detachIframeSearchShortcuts() {
        if (this._iframeShortcutDoc && this._boundDocKeydown) {
            try {
                this._iframeShortcutDoc.removeEventListener('keydown', this._boundDocKeydown, true);
            } catch {
                // Document may be torn down.
            }
        }
        this._iframeShortcutDoc = null;
    }

    _attachIframeSearchShortcuts() {
        const doc = this._getIframeDoc();
        if (!doc || !this._boundDocKeydown) {
            return;
        }
        if (this._iframeShortcutDoc === doc) {
            return;
        }
        this._detachIframeSearchShortcuts();
        doc.addEventListener('keydown', this._boundDocKeydown, true);
        this._iframeShortcutDoc = doc;
    }

    _interceptIframeLinks() {
        const doc = this._getIframeDoc();
        if (!doc) return;
        doc.addEventListener('click', function (e) {
            const a = e.target.closest('a[href]');
            if (!a) return;
            const href = a.getAttribute('href');
            if (href && /^https?:\/\//i.test(href)) {
                e.preventDefault();
                window.api.openExternal(href);
            }
        });
    }

    /**
     * Cmd+F / Ctrl+F focus search; Cmd+G / Ctrl+G next match (Web page tab only).
     *
     * @param {KeyboardEvent} e - Keyboard event (document capture).
     */
    _onDocumentKeydown(e) {
        const mod = e.metaKey || e.ctrlKey;
        if (!mod || e.altKey) {
            return;
        }
        const key = e.key.toLowerCase();
        if (key !== 'f' && key !== 'g') {
            return;
        }

        const t = e.target;
        let outsideViewer = false;
        if (t instanceof Element) {
            const field = t.closest('input, textarea, select, [contenteditable="true"]');
            if (field && !field.closest('url-input')) {
                if (this.contains(field)) {
                    outsideViewer = false;
                } else {
                    const iframeDoc = this._getIframeDoc();
                    if (!(iframeDoc && field.ownerDocument === iframeDoc)) {
                        outsideViewer = true;
                    }
                }
            }
        }

        if (key === 'f') {
            if (outsideViewer) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            const input = this.querySelector('.html-viewer-search-input');
            if (input) {
                input.focus();
                input.select();
            }
            return;
        }

        if (outsideViewer) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        this._nextMatch();
    }

    updated(changed) {
        if (changed.has('snapshot')) {
            this._loadContent();
        }
        if (changed.has('_viewMode') && this._viewMode !== 'browser') {
            this._detachIframeSearchShortcuts();
        }
        if (
            changed.has('_viewMode') || changed.has('_searchQuery')
            || changed.has('_htmlContent') || changed.has('_botviewContent')
        ) {
            this._applySearchAfterRender();
        }
    }

    async _loadContent() {
        if (!this.snapshot || this.snapshot.id === this._loadedId) return;

        this._loading = true;
        this._htmlContent = null;
        this._botviewContent = null;
        this._loadedId = this.snapshot.id;

        try {
            const [htmlContent, botviewContent] = await Promise.all([
                getSnapshotContent(this.snapshot.id),
                getSnapshotBotview(this.snapshot.id),
            ]);
            if (this._loadedId === this.snapshot.id) {
                this._htmlContent = htmlContent;
                this._botviewContent = botviewContent;
            }
        } catch (err) {
            console.error('Failed to load snapshot content:', err);
        } finally {
            this._loading = false;
        }
    }

    _getHighlightedHtml() {
        if (!this._htmlContent) return '';
        const result = hljs.highlight(this._htmlContent, { language: 'html' });
        return result.value;
    }

    _applySearchAfterRender() {
        requestAnimationFrame(() => this._highlightMatches());
    }

    _highlightMatches() {
        const query = this._searchQuery.trim();
        if (!query) {
            this._matchCount = 0;
            this._currentMatchIdx = -1;
            this._matchesCapped = false;
            if (this._viewMode === 'browser') {
                this._highlightInIframe('');
            } else if (this._viewMode === 'html') {
                this._highlightInSource('');
            } else {
                this._highlightInText('');
            }
            return;
        }

        if (this._viewMode === 'browser') {
            this._highlightInIframe(query);
        } else if (this._viewMode === 'html') {
            this._highlightInSource(query);
        } else {
            this._highlightInText(query);
        }
    }

    _getIframeDoc() {
        const iframe = this.querySelector('iframe');
        if (!iframe) return null;
        try {
            return iframe.contentDocument || iframe.contentWindow?.document;
        } catch {
            return null;
        }
    }

    _highlightInIframe(query) {
        const doc = this._getIframeDoc();
        if (!doc || !doc.body) {
            setTimeout(() => this._highlightInIframe(query), 100);
            return;
        }
        this._markTextNodes(doc.body, query);
    }

    _highlightInSource(query) {
        const pre = this.querySelector('.hljs-source-view');
        if (!pre) return;
        this._markTextNodes(pre, query);
    }

    _highlightInText(query) {
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
            this._matchesCapped = false;
            return;
        }

        const lowerQuery = query.toLowerCase();
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const matches = [];
        const textNodes = [];

        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        const MAX_MATCHES = 1000;

        for (let i = 0, i_max = textNodes.length; i < i_max && matches.length < MAX_MATCHES; ++i) {
            const node = textNodes[i];
            const text = node.textContent;
            const lowerText = text.toLowerCase();
            let startPos = 0;

            while (matches.length < MAX_MATCHES) {
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

        this._matchesCapped = matches.length >= MAX_MATCHES;
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
            if (this._viewMode === 'browser') {
                root = this._getIframeDoc()?.body;
            } else if (this._viewMode === 'html') {
                root = this.querySelector('.hljs-source-view');
            } else {
                root = this.querySelector('.botview-text-pre');
            }
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
        const value = e.target.value;
        clearTimeout(this._searchDebounceTimer);
        if (!value) {
            this._searchQuery = '';
            return;
        }
        this._searchDebounceTimer = setTimeout(() => {
            this._searchQuery = value;
        }, 250);
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
            clearTimeout(this._searchDebounceTimer);
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

        return html`
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
                                class="html-viewer-search-input bg-transparent border-none outline-none
                                       text-xs text-text-primary placeholder:text-text-muted w-full"
                                @input=${this._handleSearchInput}
                                @keydown=${this._handleSearchKeydown}
                            />
                            ${this._searchQuery
                                ? html`
                                    <span class="text-[10px] text-text-muted flex-shrink-0 tabular-nums">
                                        ${this._matchCount > 0
                                            ? `${this._currentMatchIdx + 1}/${this._matchesCapped ? `>${this._matchCount}` : this._matchCount}`
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

                    <div class="flex items-center gap-1 flex-shrink-0">
                        ${this._viewMode === 'html'
                            ? html`
                                <label class="flex items-center gap-1.5 mr-3 text-xs text-text-muted
                                              cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        .checked=${this._wrapLines}
                                        @change=${(e) => { this._wrapLines = e.target.checked; }}
                                        class="accent-accent-green cursor-pointer"
                                    />
                                    Wrap
                                </label>
                            `
                            : ''
                        }
                        <button
                            class="px-3 py-1 text-xs rounded-md transition-colors cursor-pointer
                                   ${this._viewMode === 'browser'
                                       ? 'bg-accent-green/20 text-accent-green'
                                       : 'bg-surface-2 text-text-muted hover:text-text-secondary'
                                   }"
                            @click=${() => { this._viewMode = 'browser'; }}
                        >Browser</button>
                        <button
                            class="px-3 py-1 text-xs rounded-md transition-colors cursor-pointer
                                   ${this._viewMode === 'html'
                                       ? 'bg-accent-green/20 text-accent-green'
                                       : 'bg-surface-2 text-text-muted hover:text-text-secondary'
                                   }"
                            @click=${() => { this._viewMode = 'html'; }}
                        >HTML</button>
                        <button
                            class="px-3 py-1 text-xs rounded-md transition-colors cursor-pointer
                                   ${this._viewMode === 'text'
                                       ? 'bg-accent-green/20 text-accent-green'
                                       : 'bg-surface-2 text-text-muted hover:text-text-secondary'
                                   }"
                            @click=${() => { this._viewMode = 'text'; }}
                        >Text</button>
                    </div>
                </div>

                ${this._renderContent()}
            </div>
        `;
    }

    _renderContent() {
        if (this._viewMode === 'browser') return this._renderBrowser();
        if (this._viewMode === 'html') return this._renderSource();
        return this._renderText();
    }

    _getHighlightedBotviewHtml() {
        if (!this._botviewContent) return '';

        let t = this._botviewContent
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        t = t.replace(RE_BV_STRONG, '<span class="bv-strong">$1</span>');
        t = t.replace(RE_BV_EM, '<span class="bv-em">$1</span>');
        t = t.replace(RE_BV_IMG, '<span class="bv-img">$1</span>');
        t = t.replace(RE_BV_LI, '<span class="bv-li">$1</span>');
        t = t.replace(RE_BV_A, '<span class="bv-a">$1</span>');

        for (let i = 0, i_max = RE_BV_H.length; i < i_max; ++i) {
            t = t.replace(RE_BV_H[i], '<span class="bv-h">$1</span>');
        }
        t = t.replace(RE_BV_H1, '<span class="bv-h1">$1</span>');

        return t;
    }

    _renderText() {
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
            <div class="flex-1 overflow-auto rounded-lg border border-surface-3 bg-surface-1">
                <pre class="botview-text-pre p-4 text-[13px] font-mono leading-relaxed m-0
                            text-text-muted select-text"
                     style="white-space: pre-wrap; word-break: break-word;"
                >${unsafeHTML(this._getHighlightedBotviewHtml())}</pre>
            </div>
        `;
    }

    _renderBrowser() {
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
            <iframe
                class="flex-1 w-full rounded-lg border border-surface-3 bg-surface-1"
                .srcdoc=${iframeContent}
                sandbox="allow-same-origin"
                @load=${() => {
                    this._attachIframeSearchShortcuts();
                    this._interceptIframeLinks();
                    if (this._searchQuery) {
                        this._highlightInIframe(this._searchQuery.trim());
                    }
                }}
            ></iframe>
        `;
    }

    _renderSource() {
        const highlighted = this._getHighlightedHtml();
        const wrapStyle = this._wrapLines
            ? 'white-space: pre-wrap; word-break: break-all;'
            : 'white-space: pre;';

        return html`
            <style>
                .hljs-source-view .hljs-tag { color: #569cd6; }
                .hljs-source-view .hljs-name { color: #4ec9b0; }
                .hljs-source-view .hljs-attr { color: #9cdcfe; }
                .hljs-source-view .hljs-string { color: #ce9178; }
                .hljs-source-view .hljs-comment { color: #6a9955; font-style: italic; }
                .hljs-source-view .hljs-doctag { color: #608b4e; }
                .hljs-source-view .hljs-keyword { color: #569cd6; }
                .hljs-source-view .hljs-meta { color: #569cd6; }
                .hljs-source-view .hljs-symbol { color: #b5cea8; }
            </style>
            <div class="flex-1 overflow-auto rounded-lg border border-surface-3 bg-surface-1">
                <pre class="hljs-source-view p-4 text-[13px] font-mono leading-relaxed m-0
                            text-text-secondary select-text"
                     style="${wrapStyle}"
                >${unsafeHTML(highlighted)}</pre>
            </div>
        `;
    }
}


customElements.define('html-viewer', HtmlViewer);
