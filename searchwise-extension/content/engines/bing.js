// SearchWise - Bing Search Engine Adapter
const BingAdapter = {
    engine: SW.ENGINE.BING,

    SELECTORS: {
        resultContainer: '#b_results > li.b_algo',
        resultLink: 'h2 a[href]',
        resultTitle: 'h2',
        resultSnippet: '.b_caption p, .b_lineclamp2',
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
            const linkEl = container.querySelector(this.SELECTORS.resultLink);
            const titleEl = container.querySelector(this.SELECTORS.resultTitle);
            const snippetEl = container.querySelector(this.SELECTORS.resultSnippet);

            if (!linkEl || !titleEl) return;

            const url = linkEl.href;
            const title = titleEl.textContent.trim();
            const snippet = snippetEl ? snippetEl.textContent.trim() : '';

            if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) return;

            results.push({
                element: container,
                title,
                url,
                snippet,
                blocked: false,
            });
        });

        return results;
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
