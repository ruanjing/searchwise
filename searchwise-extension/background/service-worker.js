// SearchWise - Background Service Worker
// Handles API calls, blacklist sync, token management, and message routing

const SEARCHWISE_CONFIG = {
    API_BASE: null,
    DEFAULT_RULES: [
        { domain: 'pinterest.com', category: 'content_farm' },
        { domain: 'pinterest.jp', category: 'content_farm' },
        { domain: 'csdn.net', category: 'cn_mirror' },
        { domain: 'zhuanlan.zhihu.com', category: 'cn_mirror' },
        { domain: 'zhihu.com', category: 'cn_mirror' },
        { domain: 'jianshu.com', category: 'cn_mirror' },
        { domain: 'toutiao.com', category: 'content_farm' },
        { domain: 'answers.com', category: 'content_farm' },
        { domain: 'e-how.com', category: 'content_farm' },
        { domain: 'wikihow.com', category: 'content_farm' },
        { domain: 'buzzfeed.com', category: 'content_farm' },
        { domain: 'quora.com', category: 'qa_noise' },
        { domain: 'iteye.com', category: 'cn_mirror' },
        { domain: 'jb51.net', category: 'cn_mirror' },
        { domain: 'php.cn', category: 'cn_mirror' },
        { domain: 'educba.com', category: 'low_signal_tutorial' },
        { domain: 'tutorialspoint.com', category: 'low_signal_tutorial' },
        { domain: 'javatpoint.com', category: 'low_signal_tutorial' },
        { domain: 'guru99.com', category: 'low_signal_tutorial' },
        { domain: 'w3resource.com', category: 'low_signal_tutorial' },
        { domain: 'includehelp.com', category: 'low_signal_tutorial' },
        { domain: 'brainly.com', category: 'qa_noise' },
    ],
};

SEARCHWISE_CONFIG.DEFAULT_BLACKLIST = SEARCHWISE_CONFIG.DEFAULT_RULES.map(rule => rule.domain);

const STORAGE_KEYS = {
    BLACKLIST: 'blacklist_domains',
    CUSTOM_BLACKLIST: 'custom_blacklist_domains',
    ALLOWLIST: 'allowed_domains',
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

async function getLocalAllowedDomains() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.ALLOWLIST);
    return data[STORAGE_KEYS.ALLOWLIST] || [];
}

async function setLocalCustomDomains(domains) {
    await chrome.storage.local.set({ [STORAGE_KEYS.CUSTOM_BLACKLIST]: domains });
    await refreshCombinedBlacklist();
}

async function setLocalAllowedDomains(domains) {
    await chrome.storage.local.set({ [STORAGE_KEYS.ALLOWLIST]: domains });
    await refreshCombinedBlacklist();
}

async function refreshCombinedBlacklist() {
    const customDomains = await getLocalCustomDomains();
    const allowedDomains = await getLocalAllowedDomains();
    const allowed = new Set(allowedDomains.map(d => d.domain));
    const custom = customDomains.map(d => d.domain);
    const allDomains = [...new Set([...custom, ...SEARCHWISE_CONFIG.DEFAULT_BLACKLIST])]
        .filter(domain => !allowed.has(domain));
    await chrome.storage.local.set({ [STORAGE_KEYS.BLACKLIST]: allDomains });
    return allDomains;
}

// ========== API Helper ==========

async function apiFetch(endpoint, options = {}) {
    if (!SEARCHWISE_CONFIG.API_BASE) {
        throw new Error('Cloud service is not configured in this build');
    }

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
    if (!SEARCHWISE_CONFIG.API_BASE) {
        await refreshCombinedBlacklist();
        return;
    }

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
        const allowedDomains = await getLocalAllowedDomains();
        const allowed = new Set(allowedDomains.map(d => d.domain));
        const allDomains = [
            ...(data.user_domains || []).map(d => d.domain),
            ...(data.default_domains || []).map(d => d.domain),
        ].filter(domain => !allowed.has(domain));
        await chrome.storage.local.set({ [STORAGE_KEYS.BLACKLIST]: allDomains });
    } catch (e) {
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
        ADD_ALLOWED_DOMAIN: handleAddAllowedDomain,
        REMOVE_ALLOWED_DOMAIN: handleRemoveAllowedDomain,
        IMPORT_DOMAINS: handleImportDomains,
        CHECKOUT: handleCheckout,
        BILLING_PORTAL: handleBillingPortal,
        REPORT_SPAM: handleReportSpam,
        ADD_TRUSTED_DOMAIN: handleAddTrustedDomain,
        REMOVE_TRUSTED_DOMAIN: handleRemoveTrustedDomain,
        TEST_AI_CONNECTION: handleTestAiConnection,
    };

    const handler = handlers[message.type];
    if (!handler) return false;

    // Async handlers
    handler(message.data)
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ error: error.message }));

    return true; // Keep channel open for async response
});

async function handleReportSpam(data) {
    if (!SEARCHWISE_CONFIG.API_BASE) {
        return { ok: true };
    }
    const domain = normalizeDomain(data.domain);
    try {
        await apiFetch('/blacklist/report', {
            method: 'POST',
            body: JSON.stringify({ domain })
        });
        return { ok: true };
    } catch (e) {
        console.warn('SearchWise background: Failed to report spam domain', e);
        return { ok: false, error: e.message };
    }
}

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
    const allowedDomains = await getLocalAllowedDomains();
    const allowed = new Set(allowedDomains.map(d => d.domain));
    const dataObj = await chrome.storage.local.get('trusted_domains');
    const trustedDomains = dataObj['trusted_domains'] || [];
    const localResponse = {
        all_domains: [...new Set([...customDomains.map(d => d.domain), ...SEARCHWISE_CONFIG.DEFAULT_BLACKLIST])]
            .filter(domain => !allowed.has(domain)),
        user_domains: customDomains,
        allowed_domains: allowedDomains,
        trusted_domains: trustedDomains,
        default_domains: SEARCHWISE_CONFIG.DEFAULT_RULES.map(rule => ({
            domain: rule.domain,
            category: rule.category,
            label: rule.category,
        })),
        local: true,
    };

    const token = await getToken();
    if (!token) return localResponse;

    try {
        const remoteResponse = await apiFetch('/blacklist');
        const remoteAllDomains = remoteResponse.all_domains || [
            ...(remoteResponse.user_domains || []).map(d => d.domain),
            ...(remoteResponse.default_domains || []).map(d => d.domain),
        ];
        return {
            ...remoteResponse,
            all_domains: remoteAllDomains.filter(domain => !allowed.has(domain)),
            allowed_domains: allowedDomains,
            trusted_domains: trustedDomains,
        };
    } catch (e) {
        return localResponse;
    }
}

async function handleAiSummary(data) {
    if (!SEARCHWISE_CONFIG.API_BASE) {
        throw new Error('Cloud service is not configured in this build');
    }

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
    
    const user = await getUser();
    const isPro = user && user.plan === 'pro';
    if (!isPro) {
        const bonusData = await chrome.storage.sync.get({ sharing_bonus_unlocked: false });
        const limit = bonusData.sharing_bonus_unlocked ? 50 : 20;
        if (domains.length >= limit) {
            throw new Error(`Limit reached: Free plan is limited to ${limit} custom domains. Please delete some or upgrade to Pro.`);
        }
    }

    if (domains.some(d => d.domain === domain) || SEARCHWISE_CONFIG.DEFAULT_BLACKLIST.includes(domain)) {
        throw new Error('Domain already in cleanup rules');
    }

    const allowedDomains = await getLocalAllowedDomains();
    const nextAllowed = allowedDomains.filter(d => d.domain !== domain);
    if (nextAllowed.length !== allowedDomains.length) {
        await chrome.storage.local.set({ [STORAGE_KEYS.ALLOWLIST]: nextAllowed });
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

async function handleAddAllowedDomain(data) {
    const domain = normalizeDomain(data.domain);
    if (!domain) throw new Error('Invalid domain');

    const customDomains = await getLocalCustomDomains();
    const nextCustom = customDomains.filter(d => d.domain !== domain);
    if (nextCustom.length !== customDomains.length) {
        await chrome.storage.local.set({ [STORAGE_KEYS.CUSTOM_BLACKLIST]: nextCustom });
    }

    const allowedDomains = await getLocalAllowedDomains();
    const existing = allowedDomains.find(d => d.domain === domain);
    if (existing) {
        await refreshCombinedBlacklist();
        return existing;
    }

    const item = { id: `allow-local-${Date.now()}`, domain, local: true };
    await setLocalAllowedDomains([...allowedDomains, item]);
    return item;
}

async function handleRemoveAllowedDomain(data) {
    const allowedDomains = await getLocalAllowedDomains();
    const id = String(data.id || '');
    const domain = normalizeDomain(data.domain);
    const nextAllowed = allowedDomains.filter(d => {
        if (id) return String(d.id) !== id;
        return d.domain !== domain;
    });
    await setLocalAllowedDomains(nextAllowed);
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
                    const syncSettings = await chrome.storage.sync.get({
                        custom_ai_enabled: false,
                        custom_ai_type: 'openai',
                        custom_ai_api_key: '',
                        custom_ai_endpoint: 'https://api.openai.com/v1',
                        custom_ai_model: 'gpt-4o-mini',
                    });

                    if (syncSettings.custom_ai_enabled) {
                        await handleCustomAiStream(syncSettings, msg.data.query, msg.data.results, port);
                        return;
                    }

                    if (!SEARCHWISE_CONFIG.API_BASE) {
                        port.postMessage({
                            type: 'error',
                            message: 'Cloud service is not configured in this build',
                        });
                        return;
                    }

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

// ========== Alarms (periodic sync) & Context Menus ==========

chrome.runtime.onInstalled.addListener((details) => {
    syncBlacklist();
    chrome.alarms.create('sync-blacklist', { periodInMinutes: 60 });

    // Create context menu item
    chrome.contextMenus.create({
        id: 'searchwise-add-to-blacklist',
        title: chrome.i18n.getMessage('contextMenuAdd') || '🛡️ 将此站加入 SearchWise 屏蔽列表',
        contexts: ['page', 'link']
    });

    if (details.reason === 'install') {
        chrome.storage.local.set({ onboarding_pending: true }, () => {
            chrome.runtime.openOptionsPage();
        });
    }
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'sync-blacklist') {
        syncBlacklist();
    }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'searchwise-add-to-blacklist') {
        const urlString = info.linkUrl || info.pageUrl || tab?.url;
        if (!urlString) return;

        try {
            const domain = extractDomainFromUrl(urlString);
            if (!domain) return;

            // Check if domain is already blocked
            const customDomains = await getLocalCustomDomains();
            if (customDomains.some(d => d.domain === domain) || SEARCHWISE_CONFIG.DEFAULT_BLACKLIST.includes(domain)) {
                return;
            }

            // Check limits (free plan max 20)
            const token = await getToken();
            const user = await getUser();
            const isPro = user && user.plan === 'pro';

            if (!isPro) {
                const bonusData = await chrome.storage.sync.get({ sharing_bonus_unlocked: false });
                const limit = bonusData.sharing_bonus_unlocked ? 50 : 20;
                if (customDomains.length >= limit) {
                    const msg = chrome.i18n.getMessage('customDomainsLimitReachedWithLimit', [String(limit)]) || `已达到自定义屏蔽域名上限（${limit}个）`;
                    chrome.notifications.create('', {
                        type: 'basic',
                        iconUrl: '/assets/icons/icon128.png',
                        title: 'SearchWise',
                        message: msg
                    });
                    return;
                }
            }

            // Add the domain
            await handleAddDomain({ domain });

            // Notify user
            chrome.notifications.create('', {
                type: 'basic',
                iconUrl: '/assets/icons/icon128.png',
                title: 'SearchWise',
                message: (chrome.i18n.getMessage('blockedDomainToast') || '已屏蔽 $DOMAIN$').replace('$DOMAIN$', domain)
            });
        } catch (e) {
            console.error('Error adding domain from context menu:', e);
        }
    }
});

function extractDomainFromUrl(urlString) {
    try {
        const url = new URL(urlString);
        return url.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return null;
    }
}

async function handleImportDomains(data) {
    if (!data || !Array.isArray(data.domains)) throw new Error('Invalid domains list');

    const token = await getToken();
    const user = await getUser();
    const isPro = user && user.plan === 'pro';

    const bonusData = await chrome.storage.sync.get({ sharing_bonus_unlocked: false });
    const limit = isPro ? Infinity : (bonusData.sharing_bonus_unlocked ? 50 : 20);

    const currentDomains = await getLocalCustomDomains();
    const allowedDomains = await getLocalAllowedDomains();

    let addedCount = 0;
    const nextDomains = [...currentDomains];
    const normalizedList = [];

    for (const rawDomain of data.domains) {
        const domain = normalizeDomain(rawDomain);
        if (!domain) continue;

        // Skip if already in custom list or default list
        if (nextDomains.some(d => d.domain === domain) || SEARCHWISE_CONFIG.DEFAULT_BLACKLIST.includes(domain)) {
            continue;
        }

        // Check limits
        if (nextDomains.length >= limit) {
            break;
        }

        const item = { id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, domain, local: true };
        nextDomains.push(item);
        addedCount++;
        normalizedList.push(domain);
    }

    if (addedCount > 0) {
        await setLocalCustomDomains(nextDomains);
        
        // Remove from allowlist if they were present
        const nextAllowed = allowedDomains.filter(d => !normalizedList.includes(d.domain));
        if (nextAllowed.length !== allowedDomains.length) {
            await chrome.storage.local.set({ [STORAGE_KEYS.ALLOWLIST]: nextAllowed });
        }
    }

    return { addedCount, totalCount: nextDomains.length };
}

async function handleAddTrustedDomain(data) {
    const domain = normalizeDomain(data.domain);
    if (!domain) throw new Error('Invalid domain');

    const dataObj = await chrome.storage.local.get('trusted_domains');
    const trustedDomains = dataObj['trusted_domains'] || [];
    
    if (trustedDomains.some(d => String(d.domain || d).toLowerCase() === domain)) {
        throw new Error('Domain already in trusted list');
    }

    const item = { id: `trust-local-${Date.now()}`, domain, local: true };
    const newList = [...trustedDomains, item];
    await chrome.storage.local.set({ ['trusted_domains']: newList });
    return item;
}

async function handleRemoveTrustedDomain(data) {
    const dataObj = await chrome.storage.local.get('trusted_domains');
    const trustedDomains = dataObj['trusted_domains'] || [];
    const id = String(data.id || '');
    const domain = normalizeDomain(data.domain);
    const newList = trustedDomains.filter(d => {
        if (id) return String(d.id) !== id;
        return String(d.domain || d).toLowerCase() !== domain;
    });
    await chrome.storage.local.set({ ['trusted_domains']: newList });
    return { success: true };
}

async function handleTestAiConnection(data) {
    const type = data.custom_ai_type || 'openai';
    const apiKey = data.custom_ai_api_key || '';
    let endpoint = data.custom_ai_endpoint || '';
    const model = data.custom_ai_model || 'gpt-4o-mini';

    let url = '';
    let body = {};
    let headers = {
        'Content-Type': 'application/json'
    };

    if (type === 'openai') {
        let baseUrl = endpoint.trim();
        if (!baseUrl.endsWith('/chat/completions')) {
            baseUrl = baseUrl.replace(/\/$/, '') + '/chat/completions';
        }
        url = baseUrl;
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        body = {
            model: model,
            messages: [
                { role: 'user', content: 'Ping' }
            ],
            max_tokens: 5
        };
    } else if (type === 'ollama') {
        let baseUrl = endpoint.trim();
        if (!baseUrl.endsWith('/api/chat')) {
            baseUrl = baseUrl.replace(/\/$/, '') + '/api/chat';
        }
        url = baseUrl;
        body = {
            model: model,
            messages: [
                { role: 'user', content: 'Ping' }
            ],
            stream: false,
            options: {
                num_predict: 5
            }
        };
    } else {
        throw new Error('Unsupported AI service type');
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        let errorText = '';
        try {
            errorText = await response.text();
        } catch (_) {}
        throw new Error(`Connection failed (${response.status}): ${errorText || response.statusText}`);
    }

    return { success: true };
}

async function handleCustomAiStream(syncSettings, query, results, port) {
    const type = syncSettings.custom_ai_type || 'openai';
    const apiKey = syncSettings.custom_ai_api_key || '';
    let endpoint = syncSettings.custom_ai_endpoint || '';
    const model = syncSettings.custom_ai_model || 'gpt-4o-mini';

    const systemPrompt = `你是一个智能技术搜索助手。请针对用户的搜索查询，结合以下给出的前几个搜索结果的标题、链接和摘要，生成一份结构清晰、客观准确的中文技术总结。不要虚构事实，优先使用 Markdown 格式输出。`;
    const userPrompt = `查询: ${query}\n\n搜索结果:\n${results.map((r, i) => `[${i+1}] 标题: ${r.title}\n链接: ${r.url}\n摘要: ${r.snippet || ''}`).join('\n\n')}\n\n总结报告：`;

    let url = '';
    let body = {};
    let headers = {
        'Content-Type': 'application/json'
    };

    if (type === 'openai') {
        let baseUrl = endpoint.trim();
        if (!baseUrl.endsWith('/chat/completions')) {
            baseUrl = baseUrl.replace(/\/$/, '') + '/chat/completions';
        }
        url = baseUrl;
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        body = {
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            stream: true
        };
    } else if (type === 'ollama') {
        let baseUrl = endpoint.trim();
        if (!baseUrl.endsWith('/api/chat')) {
            baseUrl = baseUrl.replace(/\/$/, '') + '/api/chat';
        }
        url = baseUrl;
        body = {
            model: model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            stream: true
        };
    } else {
        throw new Error('Unsupported AI service type');
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        let errorText = '';
        try {
            errorText = await response.text();
        } catch (_) {}
        throw new Error(`AI service error (${response.status}): ${errorText || response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        if (type === 'openai') {
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const cleanedLine = line.trim();
                if (!cleanedLine) continue;
                if (cleanedLine === 'data: [DONE]') continue;
                if (cleanedLine.startsWith('data: ')) {
                    try {
                        const json = JSON.parse(cleanedLine.substring(6));
                        const content = json.choices?.[0]?.delta?.content || '';
                        if (content) {
                            port.postMessage({ type: 'chunk', content });
                        }
                    } catch (e) {
                        console.warn('Error parsing OpenAI stream chunk:', e, cleanedLine);
                    }
                }
            }
        } else if (type === 'ollama') {
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const cleanedLine = line.trim();
                if (!cleanedLine) continue;
                try {
                    const json = JSON.parse(cleanedLine);
                    const content = json.message?.content || '';
                    if (content) {
                        port.postMessage({ type: 'chunk', content });
                    }
                } catch (e) {
                    console.warn('Error parsing Ollama stream chunk:', e, cleanedLine);
                }
            }
        }
    }

    port.postMessage({ type: 'done' });
}

