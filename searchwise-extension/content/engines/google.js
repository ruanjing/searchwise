// SearchWise - Google Search Engine Adapter
const GoogleAdapter = {
    engine: SW.ENGINE.GOOGLE,

    SELECTORS: {
        resultContainer: '#rso > div',
        resultLink: 'a[href]',
        resultTitle: 'h3',
        resultSnippet: '[data-sncf], .VwiC3b, .IsZvec',
        searchInput: 'input[name="q"]',
        rightColumn: '#rhs',
        mainContent: '#rso',
        paginationNext: '#pnnext',
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

            // Skip non-http links (google internal links, etc.)
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
