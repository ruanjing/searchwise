// SearchWise - Background Service Worker
// Handles API calls, blacklist sync, token management, and message routing

const SEARCHWISE_CONFIG = {
    API_BASE: 'http://127.0.0.1:8899/api/v1',
    DEFAULT_BLACKLIST: [
        'pinterest.com',
        'pinterest.jp',
        'csdn.net',
        'zhuanlan.zhihu.com',
        'zhihu.com',
        'jianshu.com',
        'toutiao.com',
        'answers.com',
        'e-how.com',
        'wikihow.com',
        'buzzfeed.com',
        'quora.com',
        'iteye.com',
        'jb51.net',
        'php.cn',
        'educba.com',
        'tutorialspoint.com',
    ],
};

const STORAGE_KEYS = {
    BLACKLIST: 'blacklist_domains',
    CUSTOM_BLACKLIST: 'custom_blacklist_domains',
    AUTH_TOKEN: 'auth_token',
    USER_INFO: 'user_info',
};

// ========== Token Management ==========

async function getToken() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.AUTH_TOKEN);
    return data[STORAGE_KEYS.AUTH_TOKEN] || null;
}

async function setToken(token) {
    await chrome.storage.local.set({ [STORAGE_KEYS.AUTH_TOKEN]: token });
}

async function clearToken() {
    await chrome.storage.local.remove(STORAGE_KEYS.AUTH_TOKEN);
    await chrome.storage.local.remove(STORAGE_KEYS.USER_INFO);
}

async function setUser(user) {
    await chrome.storage.local.set({ [STORAGE_KEYS.USER_INFO]: user });
}

async function getUser() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.USER_INFO);
    return data[STORAGE_KEYS.USER_INFO] || null;
}

function normalizeDomain(domain) {
    return String(domain || '')
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/.*$/, '');
}

async function getLocalCustomDomains() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.CUSTOM_BLACKLIST);
    return data[STORAGE_KEYS.CUSTOM_BLACKLIST] || [];
}

async function setLocalCustomDomains(domains) {
    await chrome.storage.local.set({ [STORAGE_KEYS.CUSTOM_BLACKLIST]: domains });
    await refreshCombinedBlacklist();
}

async function refreshCombinedBlacklist() {
    const customDomains = await getLocalCustomDomains();
    const custom = customDomains.map(d => d.domain);
    const allDomains = [...new Set([...custom, ...SEARCHWISE_CONFIG.DEFAULT_BLACKLIST])];
    await chrome.storage.local.set({ [STORAGE_KEYS.BLACKLIST]: allDomains });
    return allDomains;
}

// ========== API Helper ==========

async function apiFetch(endpoint, options = {}) {
    const token = await getToken();
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${SEARCHWISE_CONFIG.API_BASE}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options.headers },
    });

    if (response.status === 401) {
        await clearToken();
        throw new Error('Unauthorized');
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || `API error: ${response.status}`);
    }

    return data;
}

// ========== Blacklist Sync ==========

async function syncBlacklist() {
    const token = await getToken();
    if (!token) {
        // Not logged in — keep existing cache or use defaults
        const data = await chrome.storage.local.get(STORAGE_KEYS.BLACKLIST);
        if (!data[STORAGE_KEYS.BLACKLIST] || data[STORAGE_KEYS.BLACKLIST].length === 0) {
            await refreshCombinedBlacklist();
        }
        return;
    }

    try {
        const data = await apiFetch('/blacklist');
        const allDomains = [
            ...(data.user_domains || []).map(d => d.domain),
            ...(data.default_domains || []).map(d => d.domain),
        ];
        await chrome.storage.local.set({ [STORAGE_KEYS.BLACKLIST]: allDomains });
    } catch (e) {
        console.error('SearchWise: Blacklist sync failed', e);
        await refreshCombinedBlacklist();
    }
}

// ========== Message Handlers ==========

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Synchronous extension-only commands.
    if (message.type === 'BLOCKED_COUNT') {
        handleBlockedCount(message, sender);
        sendResponse({ ok: true });
        return false;
    }
    if (message.type === 'OPEN_OPTIONS') {
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
        return false;
    }

    const handlers = {
        LOGIN: handleLogin,
        REGISTER: handleRegister,
        LOGOUT: handleLogout,
        GET_USER: handleGetUser,
        FETCH_BLACKLIST: handleFetchBlacklist,
        AI_SUMMARY: handleAiSummary,
        GET_USAGE: handleGetUsage,
        ADD_DOMAIN: handleAddDomain,
        REMOVE_DOMAIN: handleRemoveDomain,
        CHECKOUT: handleCheckout,
        BILLING_PORTAL: handleBillingPortal,
    };

    const handler = handlers[message.type];
    if (!handler) return false;

    // Async handlers
    handler(message.data)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ error: error.message }));

    return true; // Keep channel open for async response
});

async function handleLogin(data) {
    const result = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
            email: data.email,
            password: data.password,
            device_name: 'chrome-extension',
        }),
    });

    await setToken(result.token);
    await setUser(result.user);

    // Sync blacklist after login
    syncBlacklist();

    return { user: result.user, token: result.token };
}

async function handleRegister(data) {
    const result = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            name: data.name,
            email: data.email,
            password: data.password,
            password_confirmation: data.password_confirmation,
            device_name: 'chrome-extension',
        }),
    });

    await setToken(result.token);
    await setUser(result.user);

    return { user: result.user, token: result.token };
}

async function handleLogout() {
    try {
        await apiFetch('/auth/logout', { method: 'POST' });
    } finally {
        await clearToken();
    }
    return { success: true };
}

async function handleGetUser() {
    try {
        const result = await apiFetch('/user');
        await setUser(result);
        return { user: result };
    } catch (e) {
        return { user: null, error: e.message };
    }
}

async function handleFetchBlacklist() {
    const customDomains = await getLocalCustomDomains();
    const localResponse = {
        all_domains: [...new Set([...customDomains.map(d => d.domain), ...SEARCHWISE_CONFIG.DEFAULT_BLACKLIST])],
        user_domains: customDomains,
        default_domains: SEARCHWISE_CONFIG.DEFAULT_BLACKLIST.map(domain => ({
            domain,
            category: 'developer_rule',
            label: domain,
        })),
        local: true,
    };

    const token = await getToken();
    if (!token) return localResponse;

    try {
        return await apiFetch('/blacklist');
    } catch (e) {
        return localResponse;
    }
}

async function handleAiSummary(data) {
    const result = await apiFetch('/summary', {
        method: 'POST',
        body: JSON.stringify({
            query: data.query,
            results: data.results,
        }),
    });
    return result;
}

async function handleGetUsage() {
    try {
        const result = await apiFetch('/user/usage');
        return result;
    } catch (e) {
        return { ai_summary: 0, domain_block: 0 };
    }
}

async function handleAddDomain(data) {
    const token = await getToken();
    const domain = normalizeDomain(data.domain);
    if (!domain) throw new Error('Invalid domain');

    if (token) {
        try {
            const result = await apiFetch('/blacklist', {
                method: 'POST',
                body: JSON.stringify({ domain }),
            });
            syncBlacklist();
            return result;
        } catch (e) {
            // Fall through to local mode.
        }
    }

    const domains = await getLocalCustomDomains();
    if (domains.some(d => d.domain === domain) || SEARCHWISE_CONFIG.DEFAULT_BLACKLIST.includes(domain)) {
        throw new Error('Domain already in cleanup rules');
    }

    const item = { id: `local-${Date.now()}`, domain, local: true };
    await setLocalCustomDomains([...domains, item]);
    return item;
}

async function handleRemoveDomain(data) {
    const token = await getToken();
    if (token && !String(data.id).startsWith('local-')) {
        try {
            const result = await apiFetch(`/blacklist/${data.id}`, {
                method: 'DELETE',
            });
            syncBlacklist();
            return result;
        } catch (e) {
            // Fall through to local removal.
        }
    }

    const domains = await getLocalCustomDomains();
    await setLocalCustomDomains(domains.filter(d => String(d.id) !== String(data.id)));
    return { success: true };
}

async function handleCheckout(data) {
    return await apiFetch('/subscription/checkout', {
        method: 'POST',
        body: JSON.stringify({
            plan: data.plan,
            success_url: data.success_url,
            cancel_url: data.cancel_url,
        }),
    });
}

async function handleBillingPortal() {
    return await apiFetch('/subscription/portal');
}

// ========== Port Handlers (Streaming) ==========
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'sw-stream') {
        port.onMessage.addListener(async (msg) => {
            if (msg.type === 'AI_SUMMARY_STREAM') {
                try {
                    const token = await getToken();
                    const response = await fetch(`${SEARCHWISE_CONFIG.API_BASE}/summary`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'text/event-stream',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify({
                            query: msg.data.query,
                            results: msg.data.results,
                            stream: true,
                        }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        port.postMessage({ type: 'error', message: errorData.error || 'API Error' });
                        return;
                    }

                    const contentType = response.headers.get('content-type') || '';
                    if (contentType.includes('application/json')) {
                        const data = await response.json();
                        port.postMessage(data);
                        return;
                    }

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';
                    let sawDone = false;

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n\n');
                        buffer = lines.pop();

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const data = JSON.parse(line.substring(6));
                                if (data.type === 'done') {
                                    sawDone = true;
                                }
                                port.postMessage(data);
                            }
                        }
                    }

                    if (!sawDone) {
                        port.postMessage({ type: 'done' });
                    }
                } catch (e) {
                    port.postMessage({ type: 'error', message: e.message });
                }
            }
        });
    }
});

function handleBlockedCount(message, sender) {
    const count = message.count || 0;
    if (sender.tab) {
        chrome.action.setBadgeText({
            text: count > 0 ? String(count) : '',
            tabId: sender.tab.id,
        });
        chrome.action.setBadgeBackgroundColor({
            color: '#4ecca3',
            tabId: sender.tab.id,
        });
    }
}

// ========== Alarms (periodic sync) ==========

chrome.runtime.onInstalled.addListener(() => {
    syncBlacklist();
    chrome.alarms.create('sync-blacklist', { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'sync-blacklist') {
        syncBlacklist();
    }
});
