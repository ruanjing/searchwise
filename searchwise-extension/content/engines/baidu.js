// SearchWise - Baidu Search Engine Adapter
const BaiduAdapter = {
    engine: SW.ENGINE.BAIDU,

    SELECTORS: {
        resultContainer: '#content_left .result, #content_left .result-op, #content_left .c-container, #content_left [tpl], #content_left > div',
        resultLink: 'h3 a[href], .c-title a[href], a[href][mu], a[href*="baidu.com/link?"]',
        resultTitle: 'h3, .c-title',
        resultSnippet: '.c-abstract, .content-right_8Zs40, .c-span-last .c-color-text, .c-span-last, .c-color-text, .content_1YWBm, .op_exactqa_s_answer',
        searchInput: '#kw, input[name="wd"]',
        rightColumn: '#content_right',
        mainContent: '#content_left',
    },

    getSearchQuery() {
        const input = document.querySelector(this.SELECTORS.searchInput);
        if (input && input.value.trim()) return input.value.trim();

        const params = new URLSearchParams(window.location.search);
        return params.get('wd') || params.get('word') || params.get('q') || '';
    },

    getResults() {
        const containers = document.querySelectorAll(this.SELECTORS.resultContainer);
        const results = [];
        const seen = new Set();

        containers.forEach(container => {
            const linkEl = container.querySelector(this.SELECTORS.resultLink);
            const titleEl = container.querySelector(this.SELECTORS.resultTitle);
            const snippetEl = container.querySelector(this.SELECTORS.resultSnippet);

            if (!linkEl || !titleEl) return;

            const url = this._resolveResultUrl(linkEl, container);
            const title = titleEl.textContent.trim();
            const snippet = snippetEl ? snippetEl.textContent.trim() : container.textContent.trim().slice(0, 240);

            if (!url || !/^https?:\/\//i.test(url)) return;
            if (!title || title.length < 2) return;
            if (seen.has(url)) return;

            seen.add(url);
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

    _resolveResultUrl(linkEl, container) {
        const candidates = [
            linkEl.getAttribute('mu'),
            linkEl.getAttribute('data-url'),
            container.getAttribute('mu'),
            container.getAttribute('data-url'),
            this._readJsonValue(linkEl.getAttribute('data-log'), 'mu'),
            this._readJsonValue(container.getAttribute('data-log'), 'mu'),
            linkEl.href,
        ].filter(Boolean);

        return candidates.find(url => /^https?:\/\//i.test(url)) || '';
    },

    _readJsonValue(raw, key) {
        if (!raw) return '';

        try {
            const data = JSON.parse(raw);
            return data?.[key] || '';
        } catch {
            const pattern = new RegExp(`["']?${key}["']?\\s*[:=]\\s*["']([^"']+)["']`);
            const match = raw.match(pattern);
            return match ? match[1] : '';
        }
    },
};
