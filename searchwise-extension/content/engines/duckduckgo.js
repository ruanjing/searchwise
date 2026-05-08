// SearchWise - DuckDuckGo Search Engine Adapter
const DuckDuckGoAdapter = {
    engine: SW.ENGINE.DUCKDUCKGO,

    SELECTORS: {
        resultContainer: '[data-testid="result"], article[data-testid="result"], .result',
        resultLink: 'a[data-testid="result-title-a"], h2 a[href], .result__title a[href], a[href]',
        resultTitle: 'h2, [data-testid="result-title-a"], .result__title',
        resultSnippet: '[data-result="snippet"], [data-testid="result-snippet"], .result__snippet',
        searchInput: 'input[name="q"], input[type="search"]',
        mainContent: '#react-layout, main, #links',
    },

    getSearchQuery() {
        const input = document.querySelector(this.SELECTORS.searchInput);
        if (input && input.value.trim()) return input.value.trim();

        const params = new URLSearchParams(window.location.search);
        return params.get('q') || '';
    },

    getResults() {
        const containers = document.querySelectorAll(this.SELECTORS.resultContainer);
        const results = [];
        const seen = new Set();

        containers.forEach(container => {
            const linkEl = container.querySelector(this.SELECTORS.resultLink);
            const titleEl = container.querySelector(this.SELECTORS.resultTitle) || linkEl;
            const snippetEl = container.querySelector(this.SELECTORS.resultSnippet);
            if (!linkEl || !titleEl) return;

            const url = this._normalizeUrl(linkEl.href);
            const title = titleEl.textContent.trim();
            const snippet = snippetEl ? snippetEl.textContent.trim() : '';

            if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) return;
            if (!title || title.length < 2) return;

            seen.add(url);
            results.push({ element: container, title, url, snippet, blocked: false });
        });

        return results;
    },

    getPageLayout() {
        return {
            hasRightColumn: false,
            mainColumn: document.querySelector(this.SELECTORS.mainContent),
            rightColumnElement: null,
            engine: this.engine,
        };
    },

    _normalizeUrl(url) {
        try {
            const parsed = new URL(url);
            if (parsed.hostname.includes('duckduckgo.com') && parsed.pathname === '/l/') {
                return parsed.searchParams.get('uddg') || url;
            }
            return url;
        } catch {
            return '';
        }
    },
};
