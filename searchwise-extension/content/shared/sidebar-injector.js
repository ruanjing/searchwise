// SearchWise - Sidebar Injector
// Creates a right sidebar panel for AI summary display using Shadow DOM
const SidebarInjector = {
    _container: null,
    _shadow: null,
    _isVisible: true,
    _engine: null,
    _lastQuery: null,
    _fetched: false,

    async init(layout, query, results) {
        await SWI18n.init();

        if (!SW.API_BASE) return;

        // Skip if already fetched for this query
        if (this._fetched && this._lastQuery === query) return;
        this._lastQuery = query;
        this._fetched = true;

        this._engine = layout.engine;

        // Filter out blocked results and those without snippet for summary
        const visibleResults = results.filter(r => !r.blocked && r.snippet).slice(0, 3);
        if (visibleResults.length === 0) { this._loading = false; return; }

        // Create or reuse container
        this._container = document.getElementById('searchwise-sidebar-root');
        if (!this._container) {
            this._container = this._createContainer(layout);
        }

        // Setup Shadow DOM
        if (!this._shadow) {
            this._shadow = this._container.attachShadow({ mode: 'open' });
            this._injectStyles();
            this._injectHTML(query);
        }

        // Update query display
        const queryText = this._shadow.getElementById('sw-query-text');
        if (queryText) queryText.textContent = query;

        // Show loading state
        this._showLoading();

        // Fetch AI summary (Try cache/stream)
        try {
            if (!(await UsageTracker.hasCloudAccess())) {
                this._showCloudRequired();
                return;
            }

            const canUse = await UsageTracker.canUseSummary();
            if (!canUse) {
                this._showLimitReached();
                return;
            }

            let fullSummary = '';
            const contentEl = this._shadow.getElementById('sw-summary-content');
            
            ApiClient.generateSummaryStream(
                query,
                visibleResults,
                (chunk) => {
                    if (fullSummary === '') {
                        this._setVisibility('sw-loading', false);
                        this._setVisibility('sw-summary', true);
                    }
                    fullSummary += chunk;
                    this._renderSummary(contentEl, fullSummary);
                },
                (finalData) => {
                    this._showSummary({ ...(finalData || {}), summary: finalData?.summary || fullSummary }, visibleResults);
                },
                (error) => {
                    this._showError(error.message || 'Failed to generate summary');
                    this._fetched = false;
                }
            );
        } catch (e) {
            this._showError(e.message || 'Failed to generate summary');
            this._fetched = false;
        }
    },

    _createContainer(layout) {
        const container = document.createElement('div');
        container.id = 'searchwise-sidebar-root';

        if (layout.hasRightColumn && layout.rightColumnElement) {
            // Replace existing right column content
            layout.rightColumnElement.innerHTML = '';
            layout.rightColumnElement.appendChild(container);
            container.style.cssText = 'width: 100%; height: 100%;';
        } else {
            // Create fixed-position sidebar
            container.style.cssText = `
                position: fixed;
                top: 0;
                right: 0;
                width: ${SW.SIDEBAR_WIDTH}px;
                height: 100vh;
                z-index: 9999;
                background: transparent;
            `;

            // Narrow main content to make room
            if (layout.mainColumn) {
                layout.mainColumn.style.marginRight = `${SW.SIDEBAR_WIDTH + 20}px`;
            }

            document.body.appendChild(container);
        }

        return container;
    },

    _injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            :host {
                all: initial;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .sw-sidebar {
                background: #1a1a2e;
                color: #e0e0e0;
                height: 100vh;
                overflow-y: auto;
                padding: 20px;
                box-sizing: border-box;
                border-left: 1px solid #2a2a4a;
            }

            .sw-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 16px;
                padding-bottom: 12px;
                border-bottom: 1px solid #2a2a4a;
            }

            .sw-logo {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .sw-logo-icon {
                width: 28px;
                height: 28px;
                background: linear-gradient(135deg, #4ecca3, #38a880);
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                font-weight: bold;
                font-size: 14px;
            }

            .sw-logo-text {
                font-size: 16px;
                font-weight: 600;
                color: #fff;
            }

            .sw-close-btn {
                background: none;
                border: none;
                color: #888;
                font-size: 20px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
            }

            .sw-close-btn:hover {
                background: #2a2a4a;
                color: #fff;
            }

            .sw-query-bar {
                background: #16213e;
                padding: 10px 14px;
                border-radius: 8px;
                margin-bottom: 16px;
                font-size: 13px;
                color: #a0a0c0;
                word-break: break-word;
            }

            .sw-query-bar span {
                color: #e0e0e0;
            }

            .sw-loading {
                text-align: center;
                padding: 40px 20px;
            }

            .sw-spinner {
                width: 36px;
                height: 36px;
                border: 3px solid #2a2a4a;
                border-top-color: #4ecca3;
                border-radius: 50%;
                animation: sw-spin 0.8s linear infinite;
                margin: 0 auto 16px;
            }

            @keyframes sw-spin {
                to { transform: rotate(360deg); }
            }

            .sw-loading p {
                color: #a0a0c0;
                font-size: 14px;
                margin: 0;
            }

            .sw-summary-content {
                font-size: 14px;
                line-height: 1.7;
                color: #d0d0e0;
            }

            .sw-summary-content h1,
            .sw-summary-content h2,
            .sw-summary-content h3 {
                color: #fff;
                margin: 16px 0 8px;
                font-size: 15px;
            }

            .sw-summary-content h1 { font-size: 17px; }
            .sw-summary-content h2 { font-size: 16px; }

            .sw-summary-content ul, .sw-summary-content ol {
                padding-left: 20px;
                margin: 8px 0;
            }

            .sw-summary-content li {
                margin: 4px 0;
            }

            .sw-summary-content strong {
                color: #4ecca3;
            }

            .sw-summary-content code {
                background: #16213e;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 13px;
            }

            .sw-summary-content a {
                color: #4ecca3;
                text-decoration: none;
            }

            .sw-summary-content a:hover {
                text-decoration: underline;
            }

            .sw-sources {
                margin-top: 20px;
                padding-top: 16px;
                border-top: 1px solid #2a2a4a;
            }

            .sw-sources h4 {
                color: #a0a0c0;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin: 0 0 10px;
            }

            .sw-source-item {
                display: block;
                padding: 8px 10px;
                margin: 4px 0;
                background: #16213e;
                border-radius: 6px;
                text-decoration: none;
                transition: background 0.2s;
            }

            .sw-source-item:hover {
                background: #1a2744;
            }

            .sw-source-title {
                font-size: 13px;
                color: #e0e0e0;
                display: block;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .sw-source-url {
                font-size: 11px;
                color: #666;
                display: block;
                margin-top: 2px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .sw-source-meta {
                display: flex;
                gap: 6px;
                align-items: center;
                margin-top: 6px;
            }

            .sw-source-badge {
                color: #4ecca3;
                background: rgba(78, 204, 163, 0.12);
                border: 1px solid rgba(78, 204, 163, 0.25);
                border-radius: 4px;
                font-size: 10px;
                line-height: 1;
                padding: 4px 5px;
                text-transform: uppercase;
            }

            .sw-error {
                text-align: center;
                padding: 30px 20px;
                color: #ff6b6b;
            }

            .sw-error p {
                margin: 0;
                font-size: 14px;
            }

            .sw-limit {
                text-align: center;
                padding: 30px 20px;
            }

            .sw-limit-icon {
                font-size: 32px;
                margin-bottom: 12px;
            }

            .sw-limit p {
                color: #a0a0c0;
                font-size: 14px;
                margin: 0 0 16px;
            }

            .sw-upgrade-btn {
                display: inline-block;
                background: linear-gradient(135deg, #4ecca3, #38a880);
                color: #fff;
                padding: 10px 24px;
                border-radius: 6px;
                text-decoration: none;
                font-weight: 600;
                font-size: 14px;
                border: none;
                cursor: pointer;
            }

            .sw-upgrade-btn:hover {
                opacity: 0.9;
            }

            .sw-footer {
                margin-top: 20px;
                padding-top: 12px;
                border-top: 1px solid #2a2a4a;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .sw-usage-count {
                font-size: 12px;
                color: #666;
            }

            .sw-footer-link {
                font-size: 12px;
                color: #4ecca3;
                text-decoration: none;
            }

            .sw-footer-link:hover {
                text-decoration: underline;
            }

        `;
        this._shadow.appendChild(style);
    },

    _injectHTML(query) {
        const div = document.createElement('div');
        div.className = 'sw-sidebar';
        div.innerHTML = `
            <div class="sw-header">
                <div class="sw-logo">
                    <span class="sw-logo-icon">S</span>
                    <span class="sw-logo-text">${this._escapeHtml(SWI18n.t('trustedAiBrief'))}</span>
                </div>
                <button class="sw-close-btn" id="sw-close-btn" title="${this._escapeHtml(SWI18n.t('close'))}">&times;</button>
            </div>
            <div class="sw-query-bar">
                ${this._escapeHtml(SWI18n.t('searching'))} <span id="sw-query-text">${this._escapeHtml(query)}</span>
            </div>
            <div id="sw-loading" class="sw-loading">
                <div class="sw-spinner"></div>
                <p>${this._escapeHtml(SWI18n.t('analyzing'))}</p>
            </div>
            <div id="sw-summary" class="sw-summary" style="display:none">
                <div id="sw-summary-content" class="sw-summary-content"></div>
            </div>
            <div id="sw-sources" class="sw-sources" style="display:none">
                <h4>${this._escapeHtml(SWI18n.t('sources'))}</h4>
                <div id="sw-sources-list"></div>
            </div>
            <div id="sw-error" class="sw-error" style="display:none">
                <p id="sw-error-message"></p>
            </div>
            <div id="sw-limit" class="sw-limit" style="display:none">
                <div class="sw-limit-icon">&#9201;</div>
                <p>${this._escapeHtml(SWI18n.t('dailyLimitReached'))}</p>
                <button class="sw-upgrade-btn" id="sw-upgrade-btn">${this._escapeHtml(SWI18n.t('upgradeToPro'))}</button>
            </div>
            <div class="sw-footer">
                <span class="sw-usage-count" id="sw-usage-count"></span>
                <a href="#" class="sw-footer-link" id="sw-upgrade-link" style="display:none">${this._escapeHtml(SWI18n.t('upgradeToPro'))}</a>
            </div>
        `;
        this._shadow.appendChild(div);

        // Event listeners
        this._shadow.getElementById('sw-close-btn').addEventListener('click', () => this.toggle());
        this._shadow.getElementById('sw-upgrade-btn').addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' }, () => {
                if (chrome.runtime.lastError) { /* ignore */ }
            });
        });
    },

    _showLoading() {
        this._setVisibility('sw-loading', true);
        this._setVisibility('sw-summary', false);
        this._setVisibility('sw-sources', false);
        this._setVisibility('sw-error', false);
        this._setVisibility('sw-limit', false);
    },

    _showSummary(data, results) {
        const contentEl = this._shadow.getElementById('sw-summary-content');
        const sourcesList = this._shadow.getElementById('sw-sources-list');
        const usageEl = this._shadow.getElementById('sw-usage-count');
        const upgradeLink = this._shadow.getElementById('sw-upgrade-link');

        // Render summary with a small safe markdown subset.
        this._renderSummary(contentEl, data.summary || SWI18n.t('noSummary'));

        // Render sources
        const sources = data.sources || results;
        sourcesList.innerHTML = sources.map(s => {
            const safeUrl = this._safeUrl(s.url);
            if (!safeUrl) return '';
            const sourceBadge = this._sourceBadge(safeUrl);

            return `
            <a href="${this._escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="sw-source-item">
                <span class="sw-source-title">${this._escapeHtml(s.title)}</span>
                <span class="sw-source-url">${this._escapeHtml(safeUrl)}</span>
                <span class="sw-source-meta">
                    <span class="sw-source-badge">${this._escapeHtml(sourceBadge)}</span>
                </span>
            </a>
        `;
        }).join('');

        // Update usage counter
        if (data && data.usage) {
            const limit = data.usage.daily_limit;
            const isCached = data.cached;
            usageEl.textContent = `${isCached ? `${SWI18n.t('cached')} - ` : ''}${limit ? `${data.usage.used_today}/${limit} ${SWI18n.t('summaries')}` : SWI18n.t('unlimited')}`;
            if (limit && data.usage.used_today >= limit - 1) {
                upgradeLink.style.display = 'inline';
            }
        }

        this._setVisibility('sw-loading', false);
        this._setVisibility('sw-summary', true);
        this._setVisibility('sw-sources', true);
    },

    _showError(message) {
        const errorEl = this._shadow.getElementById('sw-error-message');
        errorEl.textContent = message;

        this._setVisibility('sw-loading', false);
        this._setVisibility('sw-error', true);
    },

    _showLimitReached() {
        this._setVisibility('sw-loading', false);
        this._setVisibility('sw-limit', true);
    },

    _showCloudRequired() {
        const errorEl = this._shadow.getElementById('sw-error-message');
        errorEl.textContent = SWI18n.t('aiCloudRequired');

        this._setVisibility('sw-loading', false);
        this._setVisibility('sw-error', true);
    },

    _setVisibility(id, visible) {
        const el = this._shadow.getElementById(id);
        if (el) el.style.display = visible ? '' : 'none';
    },

    toggle() {
        this._isVisible = !this._isVisible;
        if (this._container) {
            this._container.style.display = this._isVisible ? '' : 'none';
        }
    },

    destroy() {
        if (this._container) {
            this._container.remove();
        }
        this._container = null;
        this._shadow = null;
    },

    showBlockedNotice(count, results, engine, query) {
        if (engine) this._noticeEngine = engine;
        if (query) this._noticeQuery = query;

        if (count === 0) {
            const existing = document.getElementById('sw-blocked-notice');
            if (existing) existing.remove();
            return;
        }

        const existing = document.getElementById('sw-blocked-notice');
        if (existing) {
            existing.dataset.count = String(count);
            this.updateBlockedNoticeState(
                existing,
                count,
                document.body.dataset.searchwiseShowBlocked === 'true',
                document.body.dataset.searchwisePageDisabled === 'true'
            );
            return;
        }

        // Find a place to insert the notice (usually above the first result)
        const firstResult = results.find(r => !r.blocked)?.element || document.querySelector('#rso');
        if (!firstResult) return;

        const notice = document.createElement('div');
        notice.id = 'sw-blocked-notice';
        notice.dataset.count = String(count);
        notice.style.cssText = `
            background: #f8f9fa;
            border: 1px solid #dadce0;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 20px;
            font-size: 14px;
            color: #3c4043;
            display: flex;
            align-items: center;
            justify-content: space-between;
        `;

        notice.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px">
                <span style="background:#4ecca3;color:white;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:12px">SearchWise</span>
                <span id="sw-filtered-count-text">${this._formatFilteredNotice(count)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
                <button id="sw-feedback-blocked" style="background:none;border:none;color:#5f6368;cursor:pointer;font-weight:500;padding:4px 8px;border-radius:4px">${this._escapeHtml(SWI18n.t('reportFalsePositive'))}</button>
                <button id="sw-show-blocked" style="background:none;border:none;color:#1a73e8;cursor:pointer;font-weight:500;padding:4px 8px;border-radius:4px">${this._escapeHtml(SWI18n.t('showHiddenResults'))}</button>
            </div>
        `;

        firstResult.parentNode.insertBefore(notice, firstResult);

        // Render current state correctly
        const isShowing = document.body.dataset.searchwiseShowBlocked === 'true';
        const isPaused = document.body.dataset.searchwisePageDisabled === 'true';
        this.updateBlockedNoticeState(notice, count, isShowing, isPaused);

        notice.querySelector('#sw-show-blocked').addEventListener('click', () => {
            const currentShowing = document.body.dataset.searchwiseShowBlocked === 'true';
            if (currentShowing) {
                // Collapse back
                delete document.body.dataset.searchwiseShowBlocked;
                const blocked = document.querySelectorAll('[data-searchwise-blocked="true"]');
                blocked.forEach(el => el.style.display = 'none');
                chrome.runtime?.sendMessage?.({ type: SW.MSG.BLOCKED_COUNT, count: count }, () => {
                    if (chrome.runtime.lastError) { /* ignore */ }
                });
                this.updateBlockedNoticeState(notice, count, false, false);
            } else {
                // Show anyway
                document.body.dataset.searchwiseShowBlocked = 'true';
                const blocked = document.querySelectorAll('[data-searchwise-blocked="true"]');
                blocked.forEach(el => el.style.display = 'block');
                chrome.runtime?.sendMessage?.({ type: SW.MSG.BLOCKED_COUNT, count: 0 }, () => {
                    if (chrome.runtime.lastError) { /* ignore */ }
                });
                this.updateBlockedNoticeState(notice, count, true, false);
            }
        });

        notice.querySelector('#sw-feedback-blocked').addEventListener('click', () => {
            this.openFalsePositiveFeedback(count);
        });

    },

    updateBlockedNoticeState(notice, count, isShowing) {
        const textEl = notice.querySelector('#sw-filtered-count-text');
        const btnEl = notice.querySelector('#sw-show-blocked');
        if (!textEl || !btnEl) return;

        if (isShowing) {
            textEl.innerHTML = this._escapeHtml(SWI18n.t('filteredJunk', [String(count)]))
                .replace(this._escapeHtml(String(count)), `<strong>${count}</strong>`) + ` (${this._escapeHtml(SWI18n.t('shown'))})`;
            btnEl.textContent = SWI18n.t('hideHiddenResults');
            btnEl.style.color = '#e03131';
        } else {
            textEl.innerHTML = this._formatFilteredNotice(count);
            btnEl.textContent = SWI18n.t('showHiddenResults');
            btnEl.style.color = '#1a73e8';
        }
    },

    openFalsePositiveFeedback(count) {
        const blocked = Array.from(document.querySelectorAll('[data-searchwise-blocked="true"]'))
            .slice(0, 15)
            .map((el, index) => {
                const domain = el.dataset.searchwiseBlockedDomain || '(unknown domain)';
                const reason = this._blockedReasonLabel(el.dataset.searchwiseBlockedReason);
                const title = this._resultTitle(el);
                return `${index + 1}. ${domain} | ${reason}${title ? ` | ${title}` : ''}`;
            });

        const version = chrome.runtime?.getManifest?.().version || 'unknown';
        const body = [
            'SearchWise feedback',
            '',
            `Type: false positive / useful result was hidden`,
            `Search engine: ${this._noticeEngine || 'unknown'}`,
            `Query: ${this._noticeQuery || ''}`,
            `Hidden result count: ${count}`,
            `Extension version: ${version}`,
            `UI language: ${SWI18n.currentLanguage()}`,
            `Browser language: ${navigator.language || ''}`,
            `Platform: ${navigator.platform || ''}`,
            `Page URL: ${location.href}`,
            '',
            'Hidden results:',
            blocked.length ? blocked.join('\n') : '(none found)',
            '',
            'What should SearchWise change?',
            '',
        ].join('\n');

        const mailto = `mailto:ruanjing40783008@126.com?subject=${encodeURIComponent('SearchWise false positive feedback')}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
    },

    _blockedReasonLabel(reasonKey) {
        if (reasonKey === 'custom') return SWI18n.t('blockedReasonCustom');
        if (reasonKey === 'content_farm') return SWI18n.t('blockedReasonContentFarm');
        if (reasonKey === 'cn_mirror') return SWI18n.t('blockedReasonCnMirror');
        if (reasonKey === 'low_signal_tutorial') return SWI18n.t('blockedReasonLowSignalTutorial');
        if (reasonKey === 'qa_noise') return SWI18n.t('blockedReasonQaNoise');
        return SWI18n.t('blockedReasonDeveloperRule');
    },

    _resultTitle(element) {
        return (element.querySelector('h3, h2, .c-title, .OrganicTitle, .res-title')?.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 120);
    },

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    },

    _formatFilteredNotice(count) {
        return this._escapeHtml(SWI18n.t('filteredJunk', [String(count)]))
            .replace(this._escapeHtml(String(count)), `<strong>${count}</strong>`);
    },

    _safeUrl(url) {
        try {
            const parsed = new URL(url);
            return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
        } catch {
            return '';
        }
    },

    _sourceBadge(url) {
        try {
            const host = new URL(url).hostname.replace(/^www\./, '');
            if (/\.(gov|edu)$/i.test(host)) return 'institution';
            if (host.includes('github.com')) return 'code';
            if (host.includes('stackoverflow.com') || host.includes('stackexchange.com')) return 'community';
            if (host.includes('docs.') || host.includes('developer.') || host.includes('learn.')) return 'docs';
            if (host.includes('pinterest') || host.includes('answers.com') || host.includes('wikihow')) return 'low signal';
            return 'source';
        } catch {
            return 'source';
        }
    },

    _renderSummary(container, text) {
        container.innerHTML = '';
        const fragment = document.createDocumentFragment();
        let currentList = null;

        String(text || '').split(/\n/).forEach(rawLine => {
            const line = rawLine.trim();
            if (!line) {
                currentList = null;
                return;
            }

            const heading = line.match(/^(#{1,3})\s+(.+)$/);
            if (heading) {
                currentList = null;
                const level = Math.min(heading[1].length, 3);
                const el = document.createElement(`h${level}`);
                this._appendInlineMarkdown(el, heading[2]);
                fragment.appendChild(el);
                return;
            }

            const bullet = line.match(/^[-*]\s+(.+)$/);
            if (bullet) {
                if (!currentList) {
                    currentList = document.createElement('ul');
                    fragment.appendChild(currentList);
                }
                const li = document.createElement('li');
                this._appendInlineMarkdown(li, bullet[1]);
                currentList.appendChild(li);
                return;
            }

            currentList = null;
            const p = document.createElement('p');
            this._appendInlineMarkdown(p, line);
            fragment.appendChild(p);
        });

        container.appendChild(fragment);
    },

    _appendInlineMarkdown(parent, text) {
        const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
        let lastIndex = 0;
        let match;

        while ((match = pattern.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parent.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
            }

            const token = match[0];
            const el = document.createElement(token.startsWith('**') ? 'strong' : 'code');
            el.textContent = token.startsWith('**') ? token.slice(2, -2) : token.slice(1, -1);
            parent.appendChild(el);
            lastIndex = pattern.lastIndex;
        }

        if (lastIndex < text.length) {
            parent.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
    },
};
