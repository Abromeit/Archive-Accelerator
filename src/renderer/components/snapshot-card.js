import { LitElement, html } from 'lit';

const NEON = '#34d399';

function iconTemplate() {
    return html`
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="2" width="16" height="16" rx="1" />
            <line x1="2" y1="7" x2="18" y2="7" />
            <line x1="7" y1="7" x2="7" y2="18" />
        </svg>
    `;
}


function iconTextOutline() {
    return html`
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="1" width="16" height="18" rx="1" />
            <line x1="5" y1="6" x2="15" y2="6" />
            <line x1="5" y1="10" x2="13" y2="10" />
            <line x1="5" y1="14" x2="11" y2="14" />
        </svg>
    `;
}


function iconTextFilled() {
    return html`
        <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" stroke="none">
            <rect x="2" y="1" width="16" height="18" rx="1" />
            <rect x="4.5" y="5" width="11" height="2.5" rx="0.5" fill="#0f0f0f" />
            <rect x="4.5" y="9" width="8.5" height="2" rx="0.5" fill="#0f0f0f" />
            <rect x="4.5" y="13" width="6.5" height="2" rx="0.5" fill="#0f0f0f" />
        </svg>
    `;
}


function iconMeta(filled) {
    if (filled) {
        return html`
            <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" stroke="none">
                <circle cx="10" cy="10" r="8" />
                <path d="M7 7l3 3-3 3" fill="none" stroke="#0f0f0f" stroke-width="1.5" />
                <line x1="11" y1="13" x2="14" y2="13" stroke="#0f0f0f" stroke-width="1.5" />
            </svg>
        `;
    }
    return html`
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="10" cy="10" r="7.5" />
            <path d="M7 7l3 3-3 3M11 13h3" />
        </svg>
    `;
}


function tipEl(text) {
    return html`<span class="tip-text">${text}</span>`;
}


export class SnapshotCard extends LitElement {
    static properties = {
        snapshot: { type: Object },
        selected: { type: Boolean },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.snapshot = null;
        this.selected = false;
    }

    _handleClick() {
        this.dispatchEvent(new CustomEvent('snapshot-selected', {
            detail: { snapshot: this.snapshot },
            bubbles: true,
            composed: true,
        }));
    }

    _getOpacity(percentage) {
        return 0.06 + (percentage / 100) * 0.38;
    }

    _getTemplateState() {
        if (!this.snapshot.templateChanged) {
            return { icon: iconTemplate(), active: false, tip: tipEl('template not changed') };
        }
        return { icon: iconTemplate(), active: true, tip: tipEl('template changed') };
    }

    _getTextState() {
        if (!this.snapshot.textChanged) {
            return { icon: iconTextOutline(), active: false, tip: tipEl('text not changed') };
        }
        if (this.snapshot.headlinesChanged) {
            return {
                icon: iconTextFilled(),
                active: true,
                tip: html`<span class="tip-text">text changed<br>with headlines</span>`,
            };
        }
        return { icon: iconTextOutline(), active: true, tip: tipEl('text changed') };
    }

    _getMetaState() {
        if (!this.snapshot.metaChanged) {
            return { icon: iconMeta(false), active: false, tip: tipEl('meta not changed') };
        }
        if (this.snapshot.titleChanged) {
            return {
                icon: iconMeta(true),
                active: true,
                tip: html`<span class="tip-text">meta changed<br>with title tag</span>`,
            };
        }
        return { icon: iconMeta(false), active: true, tip: tipEl('meta changed') };
    }

    _percentageColor(pct) {
        if (pct >= 50) return '#f87171';
        if (pct >= 25) return '#fbbf24';
        return '#34d399';
    }

    render() {
        if (!this.snapshot) return html``;

        const opacity = this._getOpacity(this.snapshot.percentage);
        const tmpl = this._getTemplateState();
        const text = this._getTextState();
        const meta = this._getMetaState();

        const borderColor = this.selected
            ? `1px solid ${NEON}`
            : '1px solid transparent';
        const shadow = this.selected
            ? `0 0 8px rgba(52, 211, 153, 0.25), inset 0 0 0 1px rgba(52, 211, 153, 0.1)`
            : 'none';

        return html`
            <button
                class="w-full text-left p-3 mb-1 cursor-pointer
                       transition-all duration-100 hover:brightness-125"
                style="background: rgba(5, 150, 105, ${opacity}); border: ${borderColor}; box-shadow: ${shadow}"
                @click=${this._handleClick}
            >
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-mono text-text-secondary tracking-tight">
                        ${this.snapshot.date}
                    </span>
                    <span class="text-xs font-semibold tabular-nums"
                          style="color: ${this._percentageColor(this.snapshot.percentage)}">
                        ${this.snapshot.percentage}%
                    </span>
                </div>

                <div class="flex items-center gap-2.5">
                    <span class="icon-tip ${tmpl.active ? 'text-accent-green' : 'text-neutral-600'}">
                        ${tmpl.icon}${tmpl.tip}
                    </span>
                    <span class="icon-tip ${text.active ? 'text-accent-green' : 'text-neutral-600'}">
                        ${text.icon}${text.tip}
                    </span>
                    <span class="icon-tip ${meta.active ? 'text-accent-green' : 'text-neutral-600'}">
                        ${meta.icon}${meta.tip}
                    </span>
                </div>
            </button>
        `;
    }
}


customElements.define('snapshot-card', SnapshotCard);
