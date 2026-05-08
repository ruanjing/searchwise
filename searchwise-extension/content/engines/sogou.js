// SearchWise - Sogou Search Engine Adapter
const SogouAdapter = {
    engine: SW.ENGINE.SOGOU,

    SELECTORS: {
        resultContainer: '#main .vrwrap, #main .results, #main .rb, #main > div',
        resultLink: 'h3 a[href], .vr-title a[href], .pt a[href], a[href]',
        resultTitle: 'h3, .vr-title, .pt',
        resultSnippet: '.str_info, .ft, .text-layout, .fz-mid, .star-wiki-abstract',
        searchInput: '#query, input[name="query"], input[name="keyword"]',
        rightColumn: '#right, .right',
        mainContent: '#main',
    },

    getSearchQuery() {
        const input = document.querySelector(this.SELECTORS.searchInput);
        if (input && input.value.trim()) return input.value.trim();

        const params = new URLSearchParams(window.location.search);
        return params.get('query') || params.get('keyword') || '';
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

            const url = this._resolveUrl(linkEl);
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

    _resolveUrl(linkEl) {
        return linkEl.getAttribute('data-url') || linkEl.getAttribute('data-href') || linkEl.href || '';
    },
};
