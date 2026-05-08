// SearchWise - Yandex Search Engine Adapter
const YandexAdapter = {
    engine: SW.ENGINE.YANDEX,

    SELECTORS: {
        resultContainer: '.serp-item, li.serp-item, [data-cid]',
        resultLink: '.OrganicTitle-Link[href], h2 a[href], a.Link[href]',
        resultTitle: '.OrganicTitle, h2, .organic__url-text',
        resultSnippet: '.OrganicTextContentSpan, .TextContainer, .organic__text',
        searchInput: 'input[name="text"], input[type="search"]',
        rightColumn: '.serp__right, aside',
        mainContent: '.content__left, main, .serp-list',
    },

    getSearchQuery() {
        const input = document.querySelector(this.SELECTORS.searchInput);
        if (input && input.value.trim()) return input.value.trim();

        const params = new URLSearchParams(window.location.search);
        return params.get('text') || '';
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

            const url = linkEl.href || '';
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
        const rightColumn = document.querySelector(this.SELECTORS.rightColumn);
        return {
            hasRightColumn: !!rightColumn,
            mainColumn: document.querySelector(this.SELECTORS.mainContent),
            rightColumnElement: rightColumn,
            engine: this.engine,
        };
    },
};
