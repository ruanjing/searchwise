// SearchWise - Bing Search Engine Adapter
const BingAdapter = {
    engine: SW.ENGINE.BING,

    SELECTORS: {
        resultContainer: '#b_results > li.b_algo',
        resultLink: ['h2 a[href]', '.b_title a[href]'],
        resultTitle: 'h2',
        resultSnippet: ['.b_caption p', '.b_lineclamp2'],
        resultDisplayUrl: ['cite', '.b_attribution cite', '.b_tpcn', '.tptt'],
        searchInput: 'input[name="q"]',
        rightColumn: '#b_context',
        mainContent: '#b_results',
    },

    getSearchQuery() {
        const input = document.querySelector(this.SELECTORS.searchInput);
        if (input) return input.value.trim();

        const params = new URLSearchParams(window.location.search);
        return params.get('q') || '';
    },

    getResults() {
        const containers = document.querySelectorAll(this.SELECTORS.resultContainer);
        const results = [];

        containers.forEach(container => {
            const linkEl = this._queryFirst(container, this.SELECTORS.resultLink);
            const titleEl = container.querySelector(this.SELECTORS.resultTitle);
            const snippetEl = this._queryFirst(container, this.SELECTORS.resultSnippet);
            const displayUrlEl = this._queryFirst(container, this.SELECTORS.resultDisplayUrl);

            if (!linkEl || !titleEl) return;

            const url = linkEl.href;
            const title = titleEl.textContent.trim();
            const snippet = snippetEl ? snippetEl.textContent.trim() : '';
            const displayUrl = displayUrlEl ? displayUrlEl.textContent.trim() : '';

            if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) return;

            results.push({
                element: container,
                title,
                url,
                displayUrl,
                snippet,
                blocked: false,
            });
        });

        return results;
    },

    _queryFirst(root, selectors) {
        const list = Array.isArray(selectors) ? selectors : [selectors];
        for (const selector of list) {
            const found = root.querySelector(selector);
            if (found) return found;
        }
        return null;
    },

    getPageLayout() {
        const rightColumn = document.querySelector(this.SELECTORS.rightColumn);
        const mainContent = document.querySelector(this.SELECTORS.mainContent);

        return {
            hasRightColumn: !!rightColumn,
            mainColumn: mainContent,
            rightColumnElement: rightColumn,
            engine: this.engine,
        };
    },
};
