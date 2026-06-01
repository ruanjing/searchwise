// SearchWise - Blacklist Engine
// Filters search results based on cached domain blacklist (offline-first)
const BlacklistEngine = {
    _domains: new Set(),
    _allowedDomains: new Set(),
    _domainSources: new Map(),

    async init() {
        const data = await chrome.storage.local.get([SW.STORAGE.BLACKLIST, SW.STORAGE.CUSTOM_BLACKLIST, SW.STORAGE.ALLOWLIST]);
        const customDomains = data[SW.STORAGE.CUSTOM_BLACKLIST] || [];
        const allowedDomains = data[SW.STORAGE.ALLOWLIST] || [];
        const customList = customDomains.map(d => d.domain).filter(Boolean);
        const allowedList = allowedDomains.map(d => d.domain).filter(Boolean);
        this._allowedDomains = new Set(allowedList.map(d => d.toLowerCase()));
        const defaultRules = SW.DEFAULT_RULES || (SW.DEFAULT_BLACKLIST || []).map(domain => ({
            domain,
            category: 'developer_rule',
        }));
        const defaultList = defaultRules.map(rule => rule.domain).filter(Boolean);
        const list = [...new Set([...(data[SW.STORAGE.BLACKLIST] || []), ...customList, ...defaultList])]
            .filter(domain => !this._allowedDomains.has(String(domain).toLowerCase()));
        this._domains = new Set(list.map(d => d.toLowerCase()));
        this._domainSources = new Map();
        customList.forEach(domain => this._domainSources.set(domain.toLowerCase(), 'custom'));
        defaultRules.forEach(rule => {
            const domain = String(rule.domain || '').toLowerCase();
            if (domain && !this._domainSources.has(domain)) {
                this._domainSources.set(domain, rule.category || 'developer_rule');
            }
        });
        await chrome.storage.local.set({ [SW.STORAGE.BLACKLIST]: list });

        // If no cached list, try to fetch from API
        if (this._domains.size === 0) {
            try {
                const response = await ApiClient.fetchBlacklist();
                if (response && response.all_domains) {
                    const allowed = new Set((response.allowed_domains || [])
                        .map(d => String(d.domain || '').toLowerCase())
                        .filter(Boolean));
                    const domains = response.all_domains.filter(domain => !allowed.has(String(domain).toLowerCase()));
                    this._allowedDomains = allowed;
                    this._domains = new Set(domains.map(d => d.toLowerCase()));
                    this._domainSources = new Map();
                    (response.user_domains || []).forEach(d => this._domainSources.set(String(d.domain || '').toLowerCase(), 'custom'));
                    (response.default_domains || []).forEach(d => this._domainSources.set(String(d.domain || '').toLowerCase(), d.category || 'developer_rule'));
                    await chrome.storage.local.set({ [SW.STORAGE.BLACKLIST]: domains });
                }
            } catch (e) {
                console.warn('SearchWise: Failed to fetch blacklist, using empty list');
            }
        }
    },

    filter(results) {
        let blockedCount = 0;
        const blockedResults = [];

        results.forEach(r => {
            const match = this._getBlockedMatch(r.url) || this._getBlockedMatch(r.displayUrl);
            if (match) {
                if (document.body.dataset.searchwiseShowBlocked !== 'true') {
                    r.element.style.display = 'none';
                }
                r.element.dataset.searchwiseBlocked = 'true';
                r.element.dataset.searchwiseBlockedReason = match.reasonKey;
                r.element.dataset.searchwiseBlockedDomain = match.domain;
                r.blocked = true;
                r.blockedReasonKey = match.reasonKey;
                r.blockedDomain = match.domain;
                blockedCount++;
                blockedResults.push(r);
            }
        });

        // Report blocked count to service worker for badge
        if (blockedCount > 0) {
            ApiClient.reportBlockedCount(blockedCount);
        }

        return { count: blockedCount, results: blockedResults };
    },

    _isBlocked(url) {
        return !!this._getBlockedMatch(url);
    },

    _getBlockedMatch(url) {
        if (!url) return false;

        try {
            const normalized = this._normalizeUrlCandidate(url);
            const hostname = new URL(normalized).hostname.toLowerCase();
            
            // Check direct match or parent domain match
            let parts = hostname.split('.');
            while (parts.length >= 2) {
                const candidate = parts.join('.');
                if (this._allowedDomains.has(candidate)) {
                    return false;
                }
                if (this._domains.has(candidate)) {
                    return {
                        domain: candidate,
                        reasonKey: this._domainSources.get(candidate) || 'developer_rule',
                    };
                }
                parts.shift();
            }
            return false;
        } catch {
            return false;
        }
    },

    _normalizeUrlCandidate(value) {
        let text = String(value || '').trim();
        text = text
            .replace(/^[\s·›>]+/, '')
            .replace(/\s*[›>].*$/, '')
            .replace(/\s+.*$/, '')
            .replace(/\/\s*$/, '');

        if (!/^https?:\/\//i.test(text)) {
            text = `https://${text}`;
        }

        return text;
    },

    getDomains() {
        return Array.from(this._domains);
    },
};
