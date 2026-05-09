// SearchWise - Main Content Script Entry Point
// Orchestrates blacklist filtering and keyword highlighting
(function () {
    'use strict';

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

    async function init() {
        // Skip if extension context has been invalidated (e.g. after extension reload)
        if (!chrome.runtime?.id) return;

        const engine = detectEngine();
        if (!engine) return;

        const adapter = getAdapter(engine);
        if (!adapter) return;

        const query = adapter.getSearchQuery();
        if (!query) return;

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
            const { count, results: blockedResults } = BlacklistEngine.filter(results);
            SidebarInjector.showBlockedNotice(count, results);
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
