// SearchWise - 360 Search Engine Adapter
const So360Adapter = {
    engine: SW.ENGINE.SO360,

    SELECTORS: {
        resultContainer: '#main .res-list, #main .result, #main > li, #main > div',
        resultLink: 'h3 a[href], .res-title a[href], a[href]',
        resultTitle: 'h3, .res-title',
        resultSnippet: '.res-desc, .res-rich, .summary, .content',
        searchInput: '#input, input[name="q"], input[type="search"]',
        rightColumn: '#side, #right, .side',
        mainContent: '#main',
    },

    getSearchQuery() {
        const input = document.querySelector(this.SELECTORS.searchInput);
        if (input && input.value.trim()) return input.value.trim();

        const params = new URLSearchParams(window.location.search);
        return params.get('q') || params.get('src') || '';
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

            const url = linkEl.getAttribute('data-url') || linkEl.href || '';
            const title = titleEl.textContent.trim();
            const snippet = snippetEl ? snippetEl.textContent.trim() : container.textContent.trim().slice(0, 240);

            if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) return;
            if (!title || title.length < 2) return;

            seen.add(url);
            results.push({ element: container, title, url, snippet, blocked: false });
        });

        return results;
    },

    getPageLayout() {
        const rightColumn = document.querySelector(this.SELECTORS.rightColumn);
        return {
            hasRightColumn: !!rightColumn,
            mainColumn: document.querySelector(this.SELECTORS.mainContent),
            rightColumnElement: rightColumn,
            engine: this.engine,
        };
    },
};
