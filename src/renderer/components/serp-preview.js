import { LitElement, html } from 'lit';

function truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}


function urlToBreadcrumb(url) {
    try {
        const u = new URL(url);
        const parts = u.pathname.split('/').filter(Boolean);
        return u.hostname + (parts.length ? ' › ' + parts.join(' › ') : '');
    } catch {
        return url;
    }
}


function extractSiteName(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.replace(/^www\./, '');
        const parts = host.split('.');
        if (parts.length >= 2) {
            return parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
        }
        return host;
    } catch {
        return url;
    }
}


function faviconUrl(url) {
    try {
        const u = new URL(url);
        return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`;
    } catch {
        return '';
    }
}


export class SerpPreview extends LitElement {
    static properties = {
        snapshot: { type: Object },
        comparisonSnapshot: { type: Object },
        liveSnapshot: { type: Object },
        mode: { type: String },
        _titleTooltip: { state: true },
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
        this._titleTooltip = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._closeTitleTooltipOnScroll = function () {
            if (this._titleTooltip) {
                this._titleTooltip = null;
                this.requestUpdate();
            }
        }.bind(this);
        window.addEventListener('scroll', this._closeTitleTooltipOnScroll, true);
    }

    disconnectedCallback() {
        window.removeEventListener('scroll', this._closeTitleTooltipOnScroll, true);
        super.disconnectedCallback();
    }

    _makeTitleEnterHandler(fullTitle) {
        const self = this;
        return function (e) {
            self._handleTitleEnter(e, fullTitle);
        };
    }

    _handleTitleEnter(e, fullTitle) {
        const rect = e.currentTarget.getBoundingClientRect();
        const margin = 12;
        const maxW = Math.min(420, Math.max(120, window.innerWidth - 2 * margin));
        let left = rect.left;
        if (left + maxW > window.innerWidth - margin) {
            left = Math.max(margin, window.innerWidth - margin - maxW);
        }
        if (left < margin) {
            left = margin;
        }
        const gapPx = 4;
        this._titleTooltip = {
            text: fullTitle,
            left,
            bottom: window.innerHeight - rect.top + gapPx,
            maxWidth: maxW,
        };
        this.requestUpdate();
    }

    _handleTitleLeave() {
        this._titleTooltip = null;
        this.requestUpdate();
    }

    _getComparisonSnap() {
        return this.mode === 'live' ? this.liveSnapshot : this.comparisonSnapshot;
    }

    _getOrderedSnippets() {
        const current = this.snapshot;
        const comparison = this._getComparisonSnap();
        if (!current) return { top: null, bottom: null, topLabel: '', bottomLabel: '', topIsSelected: false, bottomIsSelected: false };
        if (!comparison) return { top: current, bottom: null, topLabel: current.date, bottomLabel: '', topIsSelected: true, bottomIsSelected: false };

        const currentDate = new Date(current.date);
        const compDate = new Date(comparison.date);

        if (compDate > currentDate) {
            return {
                top: comparison,
                bottom: current,
                topLabel: comparison.date,
                bottomLabel: current.date,
                topIsSelected: false,
                bottomIsSelected: true,
            };
        }

        return {
            top: current,
            bottom: comparison,
            topLabel: current.date,
            bottomLabel: comparison.date,
            topIsSelected: true,
            bottomIsSelected: false,
        };
    }

    _sideLabel(isSelected) {
        if (isSelected) return 'Selected';
        return this.mode === 'live' ? 'Latest' : 'Previous';
    }

    _renderSnippet(snap, label, isSelected) {
        if (!snap) {
            return html`
                <div style="display: flex; align-items: center;">
                    <div style="width: 32px; flex-shrink: 0;"></div>
                    <div style="width: 652px; padding: 20px; text-align: center; color: rgb(154, 160, 166);">
                        No comparison available
                    </div>
                </div>
            `;
        }

        const fullTitle = snap.title || '';
        const title = truncate(fullTitle, 60);
        const showTitleTip = fullTitle.length > 60;
        const description = truncate(snap.metaDescription, 155);
        const breadcrumb = urlToBreadcrumb(snap.url);
        const siteName = extractSiteName(snap.url);
        const favicon = faviconUrl(snap.url);
        const borderLeft = isSelected ? '3px solid #34d399' : '3px solid transparent';
        const sideLabel = this._sideLabel(isSelected);
        const sideColor = isSelected ? '#34d399' : 'rgb(154, 160, 166)';

        return html`
            <div style="display: flex; align-items: center;">
                <div style="width: 32px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                    <span style="writing-mode: vertical-rl; transform: rotate(180deg);
                                 font-family: Arial, sans-serif; font-size: 10px; letter-spacing: 0.5px;
                                 text-transform: uppercase; color: ${sideColor}; white-space: nowrap;">
                        ${sideLabel}
                    </span>
                </div>
                <div style="width: 652px; padding: 16px 0 16px 16px; border-left: ${borderLeft};">
                    <div style="margin-bottom: 2px; font-size: 10px; color: rgb(154, 160, 166);
                                font-family: Arial, sans-serif; letter-spacing: 0.3px; text-transform: uppercase;">
                        ${label}
                    </div>

                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                        <img
                            src="${favicon}"
                            alt=""
                            style="width: 28px; height: 28px; border-radius: 50%; background: #303134; flex-shrink: 0;"
                            @error=${function () { this.style.display = 'none'; }}
                        />
                        <div style="min-width: 0;">
                            <div style="font-family: Arial, sans-serif; font-size: 14px; color: rgb(218, 220, 224);
                                        line-height: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${siteName}
                            </div>
                            <div style="font-family: Arial, sans-serif; font-size: 12px; color: rgb(189, 193, 198);
                                        line-height: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${breadcrumb}
                            </div>
                        </div>
                    </div>

                    ${showTitleTip
                        ? html`
                            <div
                                style="display: block; width: 100%; cursor: default;"
                                @mouseenter=${this._makeTitleEnterHandler(fullTitle)}
                                @mouseleave=${this._handleTitleLeave}
                            >
                                <div style="font-family: 'Google Sans', Arial, sans-serif; font-size: 20px;
                                            color: rgb(153, 195, 255); line-height: 26px;
                                            margin-bottom: 4px; white-space: nowrap; overflow: hidden;
                                            text-overflow: ellipsis;"
                                >${title}</div>
                            </div>
                        `
                        : html`
                            <div style="font-family: 'Google Sans', Arial, sans-serif; font-size: 20px;
                                        color: rgb(153, 195, 255); line-height: 26px;
                                        margin-bottom: 4px; white-space: nowrap; overflow: hidden;
                                        text-overflow: ellipsis;"
                            >${title}</div>
                        `
                    }

                    <div style="font-family: Arial, sans-serif; font-size: 14px; color: rgb(191, 191, 191);
                                line-height: 22px;">
                        ${description}
                    </div>
                </div>
            </div>
        `;
    }

    render() {
        if (!this.snapshot) {
            return html`
                <div class="flex items-center justify-center h-full text-text-muted text-sm">
                    Select a snapshot to preview SERP snippets
                </div>
            `;
        }

        const hasPrevious = !!this.comparisonSnapshot;
        const { top, bottom, topLabel, bottomLabel, topIsSelected, bottomIsSelected } = this._getOrderedSnippets();

        return html`
            <div class="h-full flex flex-col">
                ${this._titleTooltip
                    ? html`
                        <div
                            style="position: fixed; z-index: 10000; left: ${this._titleTooltip.left}px;
                                   bottom: ${this._titleTooltip.bottom}px; max-width: ${this._titleTooltip.maxWidth}px;
                                   pointer-events: none; filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5));"
                        >
                            <div
                                style="display: inline-block; max-width: ${this._titleTooltip.maxWidth}px;
                                       vertical-align: top;"
                            >
                                <div
                                    style="padding: 8px 10px; background: #303030; border: 1px solid #505050;
                                           border-radius: 6px; font-family: Arial, sans-serif; font-size: 13px;
                                           font-weight: normal; line-height: 1.45; color: #e8eaed;
                                           white-space: normal; word-break: break-word;"
                                >${this._titleTooltip.text}</div>
                                <div style="text-align: center; line-height: 0; margin-top: -1px;">
                                    <div
                                        style="display: inline-block; width: 0; height: 0;
                                               border-left: 10px solid transparent;
                                               border-right: 10px solid transparent;
                                               border-top: 11px solid #505050;"
                                    ></div>
                                </div>
                                <div
                                    style="text-align: center; line-height: 0; margin-top: -12px;
                                           margin-bottom: 0;"
                                >
                                    <div
                                        style="display: inline-block; width: 0; height: 0;
                                               border-left: 9px solid transparent;
                                               border-right: 9px solid transparent;
                                               border-top: 10px solid #303030;"
                                    ></div>
                                </div>
                            </div>
                        </div>
                    `
                    : ''
                }
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

                <div class="flex-1 flex flex-col items-center justify-center">
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${this._renderSnippet(top, topLabel, topIsSelected)}

                        <div style="border-top: 1px solid #3c4043; width: 652px; margin-left: 19px;"></div>

                        ${this._renderSnippet(bottom, bottomLabel, bottomIsSelected)}
                    </div>
                </div>
            </div>
        `;
    }
}


customElements.define('serp-preview', SerpPreview);
