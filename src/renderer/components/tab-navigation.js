import { LitElement, html } from 'lit';

const TABS = ['Web Page', 'Text-Diff', 'Meta', 'Charts', 'Sync Log'];

export class TabNavigation extends LitElement {
    static properties = {
        activeTab: { type: Number },
        syncing: { type: Boolean },
    };

    createRenderRoot() {
        return this;
    }

    constructor() {
        super();
        this.activeTab = 0;
        this.syncing = false;
    }

    _handleTabClick(index) {
        this.dispatchEvent(new CustomEvent('tab-changed', {
            detail: { index },
            bubbles: true,
            composed: true,
        }));
    }

    _handleKeyDown(e) {
        let newIndex = this.activeTab;
        if (e.key === 'ArrowRight') newIndex = Math.min(this.activeTab + 1, TABS.length - 1);
        else if (e.key === 'ArrowLeft') newIndex = Math.max(this.activeTab - 1, 0);
        else return;

        e.preventDefault();
        this._handleTabClick(newIndex);
        this.updateComplete.then(() => {
            const btns = this.querySelectorAll('button');
            btns[newIndex]?.focus();
        });
    }

    render() {
        return html`
            <div class="flex border-b border-surface-3 bg-surface-0 flex-shrink-0 px-4"
                 role="tablist"
                 @keydown=${this._handleKeyDown}>
                ${TABS.map((label, i) => html`
                    <button
                        role="tab"
                        tabindex="${i === this.activeTab ? 0 : -1}"
                        aria-selected="${i === this.activeTab}"
                        class="px-4 py-2.5 text-sm font-medium transition-colors duration-150
                               cursor-pointer relative flex items-center gap-1.5
                               ${i === this.activeTab
                                   ? 'text-accent-green'
                                   : 'text-text-muted hover:text-text-secondary'
                               }"
                        @click=${() => this._handleTabClick(i)}
                    >
                        ${label}
                        ${i === 4 && this.syncing
                            ? html`<span class="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse"></span>`
                            : html``
                        }
                        ${i === this.activeTab
                            ? html`<div class="absolute bottom-0 left-2 right-2 h-0.5 bg-accent-green rounded-full"></div>`
                            : html``
                        }
                    </button>
                `)}
            </div>
        `;
    }
}


customElements.define('tab-navigation', TabNavigation);
