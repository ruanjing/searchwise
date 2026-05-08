// SearchWise - Blacklist Engine
// Filters search results based on cached domain blacklist (offline-first)
const BlacklistEngine = {
    _domains: new Set(),

    async init() {
        const data = await chrome.storage.local.get(SW.STORAGE.BLACKLIST);
        const list = [...new Set([...(data[SW.STORAGE.BLACKLIST] || []), ...(SW.DEFAULT_BLACKLIST || [])])];
        this._domains = new Set(list.map(d => d.toLowerCase()));
        await chrome.storage.local.set({ [SW.STORAGE.BLACKLIST]: list });

        // If no cached list, try to fetch from API
        if (this._domains.size === 0) {
            try {
                const response = await ApiClient.fetchBlacklist();
                if (response && response.all_domains) {
                    const domains = response.all_domains;
                    this._domains = new Set(domains.map(d => d.toLowerCase()));
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
            if (this._isBlocked(r.url)) {
                r.element.style.display = 'none';
                r.element.dataset.searchwiseBlocked = 'true';
                r.blocked = true;
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
        try {
            const hostname = new URL(url).hostname.toLowerCase();
            
            // Check direct match or parent domain match
            let parts = hostname.split('.');
            while (parts.length >= 2) {
                if (this._domains.has(parts.join('.'))) return true;
                parts.shift();
            }
            return false;
        } catch {
            return false;
        }
    },

    getDomains() {
        return Array.from(this._domains);
    },
};
