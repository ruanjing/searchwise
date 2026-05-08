// SearchWise - API Client
// All API calls go through the service worker to protect the auth token
const ApiClient = {
    _isContextValid() {
        return !!chrome.runtime?.id;
    },

    async sendMessage(type, data = {}) {
        if (!this._isContextValid()) {
            throw new Error('Extension context invalidated');
        }
        return new Promise((resolve, reject) => {
            try {
                chrome.runtime.sendMessage({ type, data }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (response && response.error) {
                        reject(new Error(response.error));
                        return;
                    }
                    resolve(response);
                });
            } catch (e) {
                reject(e);
            }
        });
    },

    async login(email, password) {
        return this.sendMessage(SW.MSG.LOGIN, { email, password });
    },

    async register(name, email, password, passwordConfirmation) {
        return this.sendMessage(SW.MSG.REGISTER, {
            name, email, password, password_confirmation: passwordConfirmation,
        });
    },

    async logout() {
        return this.sendMessage(SW.MSG.LOGOUT);
    },

    async getUser() {
        return this.sendMessage(SW.MSG.GET_USER);
    },

    async fetchBlacklist() {
        return this.sendMessage(SW.MSG.FETCH_BLACKLIST);
    },

    async generateSummary(query, results) {
        return this.sendMessage(SW.MSG.AI_SUMMARY, { query, results });
    },

    generateSummaryStream(query, results, onChunk, onDone, onError) {
        if (!this._isContextValid()) {
            onError(new Error('Extension context invalidated'));
            return;
        }

        const port = chrome.runtime.connect({ name: 'sw-stream' });
        
        port.onMessage.addListener((msg) => {
            if (msg.type === 'meta') {
                // Ignore or handle meta
            } else if (msg.type === 'chunk') {
                onChunk(msg.content);
            } else if (msg.type === 'done') {
                onDone(msg);
                port.disconnect();
            } else if (msg.type === 'error') {
                onError(new Error(msg.message));
                port.disconnect();
            } else if (msg.summary) {
                // Handle cached JSON response that might come back as a single object
                onChunk(msg.summary);
                onDone(msg);
                port.disconnect();
            }
        });

        port.postMessage({
            type: 'AI_SUMMARY_STREAM',
            data: { query, results }
        });

        return port;
    },

    async getUsage() {
        return this.sendMessage(SW.MSG.GET_USAGE);
    },

    async addDomain(domain) {
        return this.sendMessage(SW.MSG.ADD_DOMAIN, { domain });
    },

    async removeDomain(id) {
        return this.sendMessage(SW.MSG.REMOVE_DOMAIN, { id });
    },

    async reportBlockedCount(count) {
        chrome.runtime.sendMessage({ type: SW.MSG.BLOCKED_COUNT, count }, () => {
            if (chrome.runtime.lastError) { /* ignore */ }
        });
    },
};
