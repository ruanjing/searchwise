// SearchWise - Main Content Script Entry Point
// Orchestrates blacklist filtering and keyword highlighting
(function () {
    'use strict';

    let currentQuery = '';

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
                content: "🛡️ SearchWise 已拦截此站 (已设为显示)" !important;
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
                display: inline-flex;
                align-items: center;
                border: 1px solid rgba(78, 204, 163, 0.55);
                border-radius: 999px;
                background: rgba(78, 204, 163, 0.08);
                color: #087f5b;
                cursor: pointer;
                font: 12px/1.2 Arial, sans-serif;
                margin: 6px 8px 2px 0;
                padding: 4px 9px;
                white-space: nowrap;
            `;

            button.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();

                button.disabled = true;
                button.textContent = SWI18n.t('blockingSite');

                try {
                    await ApiClient.addDomain(domain);
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
                result.element.dataset.searchwiseUserBlocked = 'true';
                result.element.style.display = 'none';
                ApiClient.reportBlockedCount(getBlockedCount());
                SidebarInjector.showBlockedNotice(getBlockedCount(), results);
            });

            const anchor = findActionAnchor(result.element);
            anchor.appendChild(button);
        });
    }

    function findActionAnchor(element) {
        const title = element.querySelector('h3, h2, a[href]');
        const linkParent = title?.closest?.('a[href]');
        if (linkParent?.parentElement && linkParent.parentElement !== element) {
            return linkParent.parentElement;
        }

        const parent = title?.parentElement;
        if (parent?.tagName?.toLowerCase() === 'a' && parent.parentElement) {
            return parent.parentElement;
        }

        if (parent && parent !== element) return parent;
        return element;
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
