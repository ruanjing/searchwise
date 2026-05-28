// SearchWise - Keyword Highlighter
// Highlights search keywords in result snippets using TreeWalker
const KeywordHighlighter = {
    HIGHLIGHT_CLASS: 'searchwise-highlight',
    HIGHLIGHT_TAG: 'MARK',
    STYLE_ID: 'searchwise-highlight-style',

    highlight(query, results) {
        const keywords = this._extractKeywords(query);
        if (keywords.length === 0) return;

        this._ensureStyles();

        results.forEach(r => {
            if (r.blocked || !r.element) return;
            if (r.element.dataset.searchwiseHighlightedFor === keywords.join('|')) return;

            // Highlight in title
            const titleEl = r.element.querySelector('h3, .title, h2, .OrganicTitle, .res-title, .vr-title, .c-title');
            if (titleEl) {
                this._highlightInElement(titleEl, keywords, { allowLinks: true });
            }

            // Highlight in snippet
            const snippetEl = r.element.querySelector(
                '.VwiC3b, .b_caption p, .c-abstract, .content-right_8Zs40, .OrganicTextContentSpan, .TextContainer, .result__snippet, [data-testid="result-snippet"], .str_info, .res-desc'
            );
            if (snippetEl) {
                this._highlightInElement(snippetEl, keywords, { allowLinks: false });
            }

            r.element.dataset.searchwiseHighlightedFor = keywords.join('|');
        });
    },

    _extractKeywords(query) {
        if (!query) return [];

        // Remove search operators
        const cleaned = query
            .replace(/site:\S+/gi, '')
            .replace(/inurl:\S+/gi, '')
            .replace(/intitle:\S+/gi, '')
            .replace(/filetype:\S+/gi, '')
            .replace(/"[^"]*"/g, (match) => match.slice(1, -1)) // Keep quoted phrases content
            .replace(/[+\-|]/g, ' ')
            .trim();

        // Split into words, filter short words
        const words = cleaned.split(/\s+/).filter(w => w.length > 1);

        // Deduplicate
        return [...new Set(words.map(w => w.toLowerCase()))];
    },

    _highlightInElement(element, keywords, options = {}) {
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    if (parent.closest(`.${this.HIGHLIGHT_CLASS}`)) return NodeFilter.FILTER_REJECT;
                    if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parent.tagName)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    if (this._isSearchUtilityText(parent)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    if (!options.allowLinks && parent.closest('a, [role="link"], cite, .qLRx3b, .tjvcx, .yuRUbf')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                },
            }
        );

        const textNodes = [];
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        textNodes.forEach(textNode => {
            const text = textNode.textContent;
            if (this._looksLikeSearchUtility(text)) return;

            const regex = this._buildRegex(keywords);

            if (!regex.test(text)) return;

            // Reset regex lastIndex
            regex.lastIndex = 0;

            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            let match;

            while ((match = regex.exec(text)) !== null) {
                // Text before match
                if (match.index > lastIndex) {
                    fragment.appendChild(
                        document.createTextNode(text.slice(lastIndex, match.index))
                    );
                }

                // Highlighted match
                const mark = document.createElement(this.HIGHLIGHT_TAG);
                mark.className = this.HIGHLIGHT_CLASS;
                mark.textContent = match[0];
                fragment.appendChild(mark);

                lastIndex = regex.lastIndex;
            }

            // Remaining text
            if (lastIndex < text.length) {
                fragment.appendChild(
                    document.createTextNode(text.slice(lastIndex))
                );
            }

            textNode.parentNode.replaceChild(fragment, textNode);
        });
    },

    _buildRegex(keywords) {
        const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        return new RegExp(`(${escaped.join('|')})`, 'gi');
    },

    _isSearchUtilityText(element) {
        const utilityRoot = element.closest('a, [role="link"], cite, .qLRx3b, .tjvcx, .yuRUbf');
        return this._looksLikeSearchUtility(utilityRoot?.textContent || element.textContent || '');
    },

    _looksLikeSearchUtility(text) {
        return /^(translate|cached|similar|转为|翻译|网页快照|頁庫存檔)/i.test(String(text || '').trim());
    },

    _ensureStyles() {
        if (document.getElementById(this.STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = this.STYLE_ID;
        style.textContent = `
            mark.${this.HIGHLIGHT_CLASS} {
                display: inline !important;
                box-decoration-break: clone;
                -webkit-box-decoration-break: clone;
                background: rgba(78, 204, 163, 0.45) !important;
                color: inherit !important;
                padding: 0 2px !important;
                margin: 0 !important;
                border: 0 !important;
                border-radius: 2px !important;
                font: inherit !important;
                line-height: inherit !important;
                white-space: inherit !important;
                width: auto !important;
                min-width: 0 !important;
                max-width: none !important;
                height: auto !important;
                min-height: 0 !important;
                vertical-align: baseline !important;
            }
        `;
        document.documentElement.appendChild(style);
    },
};
