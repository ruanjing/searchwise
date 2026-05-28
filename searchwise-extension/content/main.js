// SearchWise - Main Content Script Entry Point
// Orchestrates blacklist filtering and keyword highlighting
(function () {
    'use strict';

    let currentQuery = '';
    let lastStatsKey = '';

    function detectEngine() {
        const host = window.location.hostname;
        if (host.includes('google')) return SW.ENGINE.GOOGLE;
        if (host.includes('bing')) return SW.ENGINE.BING;
        if (host.includes('baidu')) return SW.ENGINE.BAIDU;
        if (host.includes('duckduckgo')) return SW.ENGINE.DUCKDUCKGO;
        if (host.includes('sogou')) return SW.ENGINE.SOGOU;
        if (host === 'so.com' || host.endsWith('.so.com')) return SW.ENGINE.SO360;
        if (host.includes('yandex')) return SW.ENGINE.YANDEX;
        return null;
    }

    function getAdapter(engine) {
        switch (engine) {
            case SW.ENGINE.GOOGLE: return GoogleAdapter;
            case SW.ENGINE.BING: return BingAdapter;
            case SW.ENGINE.BAIDU: return BaiduAdapter;
            case SW.ENGINE.DUCKDUCKGO: return DuckDuckGoAdapter;
            case SW.ENGINE.SOGOU: return SogouAdapter;
            case SW.ENGINE.SO360: return So360Adapter;
            case SW.ENGINE.YANDEX: return YandexAdapter;
            default: return null;
        }
    }

    function injectGlobalStyles() {
        if (document.getElementById('searchwise-global-styles')) return;
        const style = document.createElement('style');
        style.id = 'searchwise-global-styles';
        style.textContent = `
            /* style when blocked elements are shown anyway */
            body[data-searchwise-show-blocked="true"] [data-searchwise-blocked="true"] {
                display: block !important;
                border: 1px dashed rgba(244, 63, 94, 0.45) !important;
                background-color: rgba(244, 63, 94, 0.015) !important;
                position: relative !important;
                border-radius: 8px !important;
                padding: 12px 16px !important;
                margin-top: 10px !important;
                margin-bottom: 10px !important;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02) !important;
                transition: all 0.2s ease !important;
            }

            body[data-searchwise-show-blocked="true"] [data-searchwise-blocked="true"]:hover {
                border-color: rgba(244, 63, 94, 0.7) !important;
                background-color: rgba(244, 63, 94, 0.03) !important;
            }

            /* Premium SearchWise Blocked badge overlay */
            body[data-searchwise-show-blocked="true"] [data-searchwise-blocked="true"]::before {
                content: attr(data-searchwise-blocked-label) !important;
                display: inline-flex !important;
                align-items: center !important;
                background: #ffebee !important;
                color: #c62828 !important;
                border: 1px solid #ffcdd2 !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                padding: 3px 8px !important;
                border-radius: 4px !important;
                margin-bottom: 10px !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            }
        `;
        document.head.appendChild(style);
    }

    async function init() {
        // Skip if extension context has been invalidated (e.g. after extension reload)
        if (!chrome.runtime?.id) return;

        injectGlobalStyles();
        await SWI18n.init();

        const engine = detectEngine();
        if (!engine) return;

        const adapter = getAdapter(engine);
        if (!adapter) return;

        const query = adapter.getSearchQuery();
        if (!query) return;

        // Reset temporary bypass on query change (SPA navigation)
        if (currentQuery !== query) {
            currentQuery = query;
            delete document.body.dataset.searchwiseShowBlocked;
        }

        // Get search results
        const results = adapter.getResults();
        if (results.length === 0) return;

        // Load settings
        const settings = await chrome.storage.sync.get({
            sidebar_enabled: false,
            highlight_enabled: true,
            blacklist_enabled: true,
        });

        // Phase 1: Blacklist filtering (offline)
        if (settings.blacklist_enabled) {
            await BlacklistEngine.init();
            const { count } = BlacklistEngine.filter(results);
            applyBlockedLabels(results);
            await recordCleanupStats(engine, query, count);
            SidebarInjector.showBlockedNotice(count, results);
            attachBlockActions(results);
        }

        // Phase 2: Keyword highlighting (offline)
        if (settings.highlight_enabled) {
            KeywordHighlighter.highlight(query, results);
        }

        // Phase 3: Sidebar injection + AI summary (online)
        if (settings.sidebar_enabled) {
            const layout = adapter.getPageLayout();
            SidebarInjector.init(layout, query, results);
        }
    }

    function attachBlockActions(results) {
        results.forEach(result => {
            if (result.blocked || !result.element || result.element.dataset.searchwiseActionReady === 'true') return;

            const domain = extractDomain(result.displayUrl || result.url);
            if (!domain) return;

            result.element.dataset.searchwiseActionReady = 'true';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'searchwise-block-site-btn';
            button.textContent = SWI18n.t('blockThisSite');
            button.title = SWI18n.t('blockThisSiteTitle', [domain]);
            button.style.cssText = `
                all: unset !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                border: 1px solid rgba(78, 204, 163, 0.55) !important;
                border-radius: 999px !important;
                background: rgba(78, 204, 163, 0.08) !important;
                color: #087f5b !important;
                cursor: pointer !important;
                direction: ltr !important;
                font: 12px/1.2 Arial, "Microsoft YaHei", sans-serif !important;
                letter-spacing: 0 !important;
                margin: 0 !important;
                padding: 4px 9px !important;
                text-align: center !important;
                text-orientation: mixed !important;
                transform: none !important;
                unicode-bidi: isolate !important;
                white-space: nowrap !important;
                writing-mode: horizontal-tb !important;
            `;

            button.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();

                button.disabled = true;
                button.textContent = SWI18n.t('blockingSite');

                let addedDomain = null;
                try {
                    addedDomain = await ApiClient.addDomain(domain);
                } catch (e) {
                    if (!String(e.message || '').toLowerCase().includes('already')) {
                        button.disabled = false;
                        button.textContent = SWI18n.t('blockThisSite');
                        button.title = `${SWI18n.t('failedAddDomain', [e.message])}`;
                        return;
                    }
                }

                result.blocked = true;
                result.element.dataset.searchwiseBlocked = 'true';
                result.element.dataset.searchwiseBlockedLabel = SWI18n.t('blockedResultShownLabel');
                result.element.dataset.searchwiseUserBlocked = 'true';
                result.element.style.display = 'none';
                ApiClient.reportBlockedCount(getBlockedCount());
                SidebarInjector.showBlockedNotice(getBlockedCount(), results);
                showUndoToast(domain, async () => {
                    if (addedDomain?.id) {
                        await ApiClient.removeDomain(addedDomain.id);
                    }

                    result.blocked = false;
                    result.element.removeAttribute('data-searchwise-blocked');
                    result.element.removeAttribute('data-searchwise-blocked-label');
                    result.element.removeAttribute('data-searchwise-user-blocked');
                    result.element.style.display = '';
                    button.disabled = false;
                    button.textContent = SWI18n.t('blockThisSite');
                    button.title = SWI18n.t('blockThisSiteTitle', [domain]);
                    SidebarInjector.showBlockedNotice(getBlockedCount(), results);
                    ApiClient.reportBlockedCount(getBlockedCount());
                });
            });

            const actionRow = document.createElement('div');
            actionRow.className = 'searchwise-block-action-row';
            actionRow.style.cssText = `
                display: flex !important;
                align-items: center !important;
                direction: ltr !important;
                margin: 4px 0 2px !important;
                transform: none !important;
                unicode-bidi: isolate !important;
                writing-mode: horizontal-tb !important;
            `;
            actionRow.appendChild(button);
            insertBlockAction(result.element, actionRow);
        });
    }

    async function recordCleanupStats(engine, query, count) {
        if (!count) return;

        const statsKey = `${engine}:${query}:${location.pathname}:${location.search}`;
        if (lastStatsKey === statsKey) return;
        if (sessionStorage.getItem('sw_last_stats_key') === statsKey) return;
        lastStatsKey = statsKey;
        sessionStorage.setItem('sw_last_stats_key', statsKey);

        const today = new Date().toISOString().slice(0, 10);
        const data = await chrome.storage.local.get({
            sw_stats: { totalFiltered: 0, dailyFiltered: {} },
        });
        const stats = data.sw_stats || { totalFiltered: 0, dailyFiltered: {} };
        stats.totalFiltered = Number(stats.totalFiltered || 0) + count;
        stats.dailyFiltered = stats.dailyFiltered || {};
        stats.dailyFiltered[today] = Number(stats.dailyFiltered[today] || 0) + count;

        const keepDates = new Set(
            Array.from({ length: 30 }, (_, index) => {
                const date = new Date();
                date.setDate(date.getDate() - index);
                return date.toISOString().slice(0, 10);
            })
        );
        Object.keys(stats.dailyFiltered).forEach(date => {
            if (!keepDates.has(date)) delete stats.dailyFiltered[date];
        });

        await chrome.storage.local.set({ sw_stats: stats });
    }

    function showUndoToast(domain, onUndo) {
        const existing = document.getElementById('sw-undo-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'sw-undo-toast';
        toast.style.cssText = `
            position: fixed;
            left: 24px;
            bottom: 24px;
            z-index: 2147483647;
            display: flex;
            align-items: center;
            gap: 12px;
            max-width: min(420px, calc(100vw - 48px));
            background: #202124;
            color: #fff;
            border-radius: 8px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.2);
            padding: 12px 14px;
            font: 13px/1.4 Arial, sans-serif;
        `;
        toast.innerHTML = `
            <span>${escapeHtml(SWI18n.t('blockedDomainToast', [domain]))}</span>
            <button type="button" style="background:none;border:none;color:#8ab4f8;cursor:pointer;font:600 13px/1.4 Arial,sans-serif;padding:4px 2px">${escapeHtml(SWI18n.t('undo'))}</button>
        `;

        const timer = setTimeout(() => toast.remove(), 7000);
        toast.querySelector('button').addEventListener('click', async () => {
            clearTimeout(timer);
            const button = toast.querySelector('button');
            button.disabled = true;
            try {
                await onUndo();
                toast.querySelector('span').textContent = SWI18n.t('undoDone');
                setTimeout(() => toast.remove(), 1600);
            } catch (e) {
                toast.querySelector('span').textContent = e.message || SWI18n.t('undoFailed');
                button.disabled = false;
            }
        });

        document.body.appendChild(toast);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    function applyBlockedLabels(results) {
        results.forEach(result => {
            if (!result.blocked || !result.element) return;
            result.element.dataset.searchwiseBlockedLabel = SWI18n.t('blockedResultShownLabel');
        });
    }

    function insertBlockAction(element, actionRow) {
        const title = element.querySelector('h3, h2, a[href]');
        const linkParent = title?.closest?.('a[href]');
        if (linkParent?.parentElement && linkParent.parentElement !== element) {
            linkParent.parentElement.insertAdjacentElement('afterend', actionRow);
            return;
        }

        const parent = title?.parentElement;
        if (parent?.tagName?.toLowerCase() === 'a' && parent.parentElement) {
            parent.parentElement.insertAdjacentElement('afterend', actionRow);
            return;
        }

        if (parent && parent !== element) {
            parent.insertAdjacentElement('afterend', actionRow);
            return;
        }

        element.appendChild(actionRow);
    }

    function extractDomain(value) {
        if (!value) return '';

        try {
            let text = String(value).trim()
                .replace(/^[\s›>·|/-]+/, '')
                .replace(/\s*[›>·|].*$/, '')
                .replace(/\s+.*$/, '')
                .replace(/\/\s*$/, '');

            if (!/^https?:\/\//i.test(text)) {
                text = `https://${text}`;
            }

            return new URL(text).hostname.toLowerCase().replace(/^www\./, '');
        } catch {
            return '';
        }
    }

    function getBlockedCount() {
        return document.querySelectorAll('[data-searchwise-blocked="true"]').length;
    }

    // Run when DOM is ready (content_scripts run at document_idle)
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }

    // Re-run on dynamic content changes (SPA navigation)
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(init, 1000);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
})();
