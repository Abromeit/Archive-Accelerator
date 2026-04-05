import { LitElement, html } from 'lit';

const LEVEL_CONFIG = {
    info:    { icon: 'ℹ', color: 'text-accent-blue',   bg: 'bg-accent-blue/10',   dot: 'bg-accent-blue'   },
    success: { icon: '✓', color: 'text-accent-green',  bg: 'bg-accent-green/10',  dot: 'bg-accent-green'  },
    warn:    { icon: '⚠', color: 'text-accent-amber',  bg: 'bg-accent-amber/10',  dot: 'bg-accent-amber'  },
    error:   { icon: '✕', color: 'text-diff-removed',  bg: 'bg-diff-removed/10',  dot: 'bg-diff-removed'  },
};

const PHASE_LABELS = {
    discovering: 'Discovery',
    downloading: 'Downloading',
    processing:  'Processing',
    complete:    'Complete',
};


export class SyncLogViewer extends LitElement {
    static properties = {
        currentUrl: { type: String },
        syncing: { type: Boolean },
        progress: { type: Object },
        _entries: { state: true },
        _autoScroll: { state: true },
        _groupedBySession: { state: true },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.currentUrl = '';
        this.syncing = false;
        this.progress = null;
        this._entries = [];
        this._autoScroll = true;
        this._groupedBySession = [];
        this._pendingEntries = [];
        this._rafId = null;
        this._liveSessionId = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._loadPersistedLogs();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    async _loadPersistedLogs() {
        if (!this.currentUrl) return;
        try {
            const logs = await window.api.getSyncLogs(this.currentUrl);
            this._entries = logs || [];
            this._liveSessionId = null;
            this._rebuildGroups();
            this._scrollToTop();
        } catch (_e) {
            this._entries = [];
            this._liveSessionId = null;
            this._groupedBySession = [];
        }
    }

    updated(changedProps) {
        if (changedProps.has('currentUrl') && this.currentUrl) {
            this._loadPersistedLogs();
        }
    }

    addLogEntry(entry) {
        if (entry.session_id) {
            this._liveSessionId = entry.session_id;
        }
        this._pendingEntries.push(entry);
        if (!this._rafId) {
            this._rafId = requestAnimationFrame(() => {
                this._flushPending();
                this._rafId = null;
            });
        }
    }

    _flushPending() {
        if (this._pendingEntries.length === 0) return;
        this._entries = [...this._entries, ...this._pendingEntries];
        this._pendingEntries = [];
        this._rebuildGroups();
        if (this._autoScroll) {
            this._scrollToTop();
        }
    }

    _rebuildGroups() {
        const groups = [];
        let currentGroup = null;

        for (let i = 0, i_max = this._entries.length; i < i_max; ++i) {
            const entry = this._entries[i];
            if (!currentGroup || currentGroup.sessionId !== entry.session_id) {
                currentGroup = {
                    sessionId: entry.session_id,
                    startTime: entry.timestamp,
                    entries: [],
                };
                groups.push(currentGroup);
            }
            currentGroup.entries.push(entry);
        }

        groups.reverse();
        this._groupedBySession = groups;
    }

    _scrollToTop() {
        requestAnimationFrame(() => {
            const container = this.querySelector('.sync-log-scroll');
            if (container) {
                container.scrollTop = 0;
            }
        });
    }

    _handleScroll(e) {
        const el = e.target;
        const atTop = el.scrollTop < 40;
        this._autoScroll = atTop;
    }

    _formatTime(ts) {
        const d = new Date(ts);
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    _formatDate(ts) {
        const d = new Date(ts);
        return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    _formatTimeSince(ts) {
        const diff = Date.now() - ts;
        if (diff < 60_000) return 'just now';
        if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
        if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
        return `${Math.floor(diff / 86_400_000)}d ago`;
    }

    _renderProgressBar() {
        if (!this.syncing || !this.progress) return html``;

        const pct = this.progress.total > 0
            ? Math.round((this.progress.current / this.progress.total) * 100)
            : 0;

        const phaseLabel = PHASE_LABELS[this.progress.phase] || this.progress.phase;

        return html`
            <div class="mx-4 mt-4 rounded-xl bg-surface-1 border border-surface-3 overflow-hidden">
                <div class="flex items-center justify-between px-4 py-3">
                    <div class="flex items-center gap-3">
                        <div class="relative flex items-center justify-center w-8 h-8">
                            <svg class="animate-spin text-accent-green" width="32" height="32"
                                 viewBox="0 0 32 32" fill="none">
                                <circle cx="16" cy="16" r="14" stroke="currentColor"
                                        stroke-width="3" opacity="0.2" />
                                <path d="M16 2a14 14 0 0 1 14 14" stroke="currentColor"
                                      stroke-width="3" stroke-linecap="round" />
                            </svg>
                        </div>
                        <div>
                            <div class="text-sm font-medium text-text-primary">
                                ${phaseLabel}
                            </div>
                            <div class="text-xs text-text-muted">
                                ${this.progress.current} / ${this.progress.total} snapshots
                            </div>
                        </div>
                    </div>
                    <span class="text-sm font-medium tabular-nums text-accent-green">${pct}%</span>
                </div>
                <div class="h-1 bg-surface-2">
                    <div class="h-full bg-accent-green transition-all duration-300 ease-out"
                         style="width: ${pct}%"></div>
                </div>
            </div>
        `;
    }

    _renderEntry(entry) {
        const cfg = LEVEL_CONFIG[entry.level] || LEVEL_CONFIG.info;
        const isLive = this._liveSessionId && entry.session_id === this._liveSessionId;
        const animStyle = isLive
            ? `animation: logSlideIn 0.15s ease-out`
            : '';

        return html`
            <div class="flex items-start gap-3 px-4 py-1.5 hover:bg-surface-1/50
                        transition-colors duration-100 sync-log-entry"
                 style="${animStyle}">
                <span class="flex-shrink-0 w-[52px] text-[11px] tabular-nums text-text-muted
                             pt-px text-right font-mono">
                    ${this._formatTime(entry.timestamp)}
                </span>
                <span class="flex-shrink-0 w-4 h-4 rounded-full ${cfg.bg}
                             flex items-center justify-center mt-0.5">
                    <span class="w-1.5 h-1.5 rounded-full ${cfg.dot}"></span>
                </span>
                <span class="text-sm ${cfg.color} leading-relaxed break-words min-w-0">
                    ${entry.message}
                </span>
            </div>
        `;
    }

    _renderSessionGroup(group) {
        const lastEntry = group.entries[group.entries.length - 1];
        const isComplete = lastEntry?.phase === 'complete' && lastEntry?.level === 'success';
        const hasErrors = group.entries.some(function (e) { return e.level === 'error'; });

        let statusIcon, statusColor;
        if (isComplete && !hasErrors) {
            statusIcon = '✓';
            statusColor = 'text-accent-green';
        } else if (isComplete && hasErrors) {
            statusIcon = '⚠';
            statusColor = 'text-accent-amber';
        } else {
            statusIcon = '●';
            statusColor = 'text-accent-blue';
        }

        return html`
            <div class="mb-4">
                <div class="flex items-center gap-2 px-4 py-2 sticky top-0 z-10
                            bg-surface-0/95 backdrop-blur-sm border-b border-surface-2">
                    <span class="${statusColor} text-xs">${statusIcon}</span>
                    <span class="text-xs font-medium text-text-secondary">
                        ${this._formatDate(group.startTime)}
                    </span>
                    <span class="text-[11px] text-text-muted">
                        ${this._formatTime(group.startTime)}
                    </span>
                    <span class="ml-auto text-[11px] text-text-muted">
                        ${group.entries.length} events · ${this._formatTimeSince(group.startTime)}
                    </span>
                </div>
                <div class="py-1">
                    ${group.entries.slice().reverse().map(
                        (e) => this._renderEntry(e)
                    )}
                </div>
            </div>
        `;
    }

    _renderEmptyState() {
        return html`
            <div class="flex flex-col items-center justify-center h-full text-center px-8">
                <div class="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="1.5" class="text-text-muted">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                    </svg>
                </div>
                <h3 class="text-sm font-medium text-text-secondary mb-1">No sync logs yet</h3>
                <p class="text-xs text-text-muted max-w-[280px]">
                    Hit the Sync button to start downloading snapshots.
                    Every step will be logged here in real time.
                </p>
            </div>
        `;
    }

    render() {
        const isEmpty = this._groupedBySession.length === 0 && !this.syncing;

        return html`
            <style>
                @keyframes logSlideIn {
                    from { opacity: 0; transform: translateY(-4px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            </style>

            <div class="flex flex-col h-full -m-4">
                ${this._renderProgressBar()}

                ${isEmpty
                    ? this._renderEmptyState()
                    : html`
                        <div class="flex-1 overflow-y-auto sync-log-scroll scroll-smooth"
                             @scroll=${this._handleScroll}>
                            <div class="py-2">
                                ${this._groupedBySession.map(
                                    (group) => this._renderSessionGroup(group)
                                )}
                            </div>

                            ${!this._autoScroll ? html`
                                <button
                                    class="fixed top-28 right-6 z-20 w-8 h-8 rounded-full
                                           bg-accent-green text-surface-0
                                           flex items-center justify-center shadow-lg
                                           hover:bg-accent-green/90 transition-colors cursor-pointer"
                                    @click=${() => { this._autoScroll = true; this._scrollToTop(); }}
                                    title="Scroll to latest"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                         stroke="currentColor" stroke-width="2.5">
                                        <polyline points="18 15 12 9 6 15" />
                                    </svg>
                                </button>
                            ` : html``}
                        </div>
                    `
                }
            </div>
        `;
    }
}


customElements.define('sync-log-viewer', SyncLogViewer);
