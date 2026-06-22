// SearchWise - Usage Tracker
// Tracks local usage counts for UI display
const UsageTracker = {
    async getUsage() {
        const token = await this._getToken();
        if (!token) {
            return {
                ai_summary: 0,
                domain_block: 0,
            };
        }

        try {
            const response = await ApiClient.getUsage();
            return response;
        } catch (e) {
            // Offline or not logged in — return zeros
            return {
                ai_summary: 0,
                domain_block: 0,
            };
        }
    },

    async getLimits() {
        const token = await this._getToken();
        if (!token) {
            return {
                max_domains: SW.LIMITS.LOCAL_FREE_DOMAINS,
                max_ai_summaries_per_day: 0,
            };
        }

        try {
            const response = await ApiClient.getUser();
            if (response && response.user) {
                return response.user.limits || {
                    max_domains: SW.LIMITS.LOCAL_FREE_DOMAINS,
                    max_ai_summaries_per_day: SW.LIMITS.FREE_AI_SUMMARIES_PER_DAY,
                };
            }
        } catch (e) {
            // Not logged in
        }

        return {
            max_domains: SW.LIMITS.LOCAL_FREE_DOMAINS,
            max_ai_summaries_per_day: 0,
        };
    },

    async hasCloudAccess() {
        const settings = await chrome.storage.sync.get({ custom_ai_enabled: false });
        if (settings.custom_ai_enabled) return true;
        return !!(await this._getToken());
    },

    async canUseSummary() {
        const settings = await chrome.storage.sync.get({ custom_ai_enabled: false });
        if (settings.custom_ai_enabled) return true;
        const [usage, limits] = await Promise.all([
            this.getUsage(),
            this.getLimits(),
        ]);

        if (limits.max_ai_summaries_per_day === null) return true; // Pro = unlimited
        return usage.ai_summary < limits.max_ai_summaries_per_day;
    },

    async _getToken() {
        const data = await chrome.storage.local.get(SW.STORAGE.AUTH_TOKEN);
        return data[SW.STORAGE.AUTH_TOKEN] || null;
    },
};
