// SearchWise - Options Page Script
(function () {
    'use strict';

    const $ = id => document.getElementById(id);
    let currentUser = null;
    let userDomains = [];
    let defaultDomains = [];

    // ===== Navigation =====
    document.querySelectorAll('.sw-nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;

            document.querySelectorAll('.sw-nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            document.querySelectorAll('.sw-section').forEach(s => s.style.display = 'none');
            $(`section-${section}`).style.display = '';
        });
    });

    // ===== Init =====
    async function init() {
        await SWI18n.init();
        document.title = SWI18n.t('settingsTitle');
        SWI18n.apply();

        // Load settings
        const settings = await chrome.storage.sync.get({
            blacklist_enabled: true,
            sidebar_enabled: true,
            highlight_enabled: true,
            language: 'auto',
        });

        $('opt-blacklist').checked = settings.blacklist_enabled;
        $('opt-sidebar').checked = settings.sidebar_enabled;
        $('opt-highlight').checked = settings.highlight_enabled;
        $('opt-language').value = settings.language || 'auto';

        // Check auth status
        const tokenData = await chrome.storage.local.get('auth_token');
        if (tokenData.auth_token) {
            await loadUser();
        }

        // Load blacklist
        await loadBlacklist();
    }

    async function loadUser() {
        try {
            const response = await sendMessage('GET_USER');
            if (response && response.user) {
                currentUser = response.user;
                updateAccountUI();
            }
        } catch (e) {
            // Not logged in
        }
    }

    function updateAccountUI() {
        if (!currentUser) {
            $('account-not-logged-in').style.display = '';
            $('account-logged-in').style.display = 'none';
            $('sub-free').style.display = '';
            $('sub-pro').style.display = 'none';
            return;
        }

        $('account-not-logged-in').style.display = 'none';
        $('account-logged-in').style.display = '';

        $('opt-account-name').textContent = currentUser.name;
        $('opt-account-email').textContent = currentUser.email;
        $('opt-account-plan').textContent = currentUser.plan === 'pro' ? SWI18n.t('proPlan') : SWI18n.t('freePlan');

        if (currentUser.plan === 'pro') {
            $('sub-free').style.display = 'none';
            $('sub-pro').style.display = '';
        } else {
            $('sub-free').style.display = '';
            $('sub-pro').style.display = 'none';
        }
    }

    async function loadBlacklist() {
        try {
            const response = await sendMessage('FETCH_BLACKLIST');
            if (response) {
                userDomains = response.user_domains || [];
                defaultDomains = response.default_domains || [];
                renderBlacklist();
            }
        } catch (e) {
            // Load from cache
            const data = await chrome.storage.local.get('blacklist_domains');
            defaultDomains = (data.blacklist_domains || []).map(d => ({
                domain: d, source: 'default',
            }));
            renderBlacklist();
        }
    }

    function renderBlacklist() {
        const list = $('domain-list');
        const limitText = $('domain-limit-text');

        let html = '';

        // User domains
        userDomains.forEach(d => {
            html += `
                <div class="sw-domain-item">
                    <div>
                        <span class="sw-domain-name">${escapeHtml(d.domain)}</span>
                        <span class="sw-domain-source">(${SWI18n.t('customLabel')})</span>
                    </div>
                    <button class="sw-domain-remove" data-id="${d.id}" data-domain="${escapeHtml(d.domain)}" title="${SWI18n.t('close')}">&times;</button>
                </div>
            `;
        });

        // Default domains
        defaultDomains.forEach(d => {
            html += `
                <div class="sw-domain-item">
                    <div>
                        <span class="sw-domain-name">${escapeHtml(d.domain)}</span>
                        <span class="sw-domain-source">(${SWI18n.t('defaultLabel')}${d.label ? ' - ' + escapeHtml(d.label) : ''})</span>
                    </div>
                </div>
            `;
        });

        list.innerHTML = html;

        // Update limit text
        const limit = currentUser?.limits?.max_domains || 20;
        limitText.textContent = SWI18n.t('customDomainsLimit', [
            String(userDomains.length),
            String(limit),
            currentUser?.plan !== 'pro' ? SWI18n.t('upgradeForUnlimited') : '',
        ]);

        // Remove buttons
        list.querySelectorAll('.sw-domain-remove').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                try {
                    await sendMessage('REMOVE_DOMAIN', { id });
                    await loadBlacklist();
                } catch (e) {
                    alert(SWI18n.t('failedRemoveDomain', [e.message]));
                }
            });
        });
    }

    // ===== Add Domain =====
    $('add-domain-btn').addEventListener('click', async () => {
        const input = $('new-domain');
        const domain = input.value.trim().toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/^www\./, '')
            .replace(/\/.*$/, '');

        if (!domain) return;

        $('add-domain-btn').disabled = true;
        $('add-domain-btn').textContent = SWI18n.t('adding');

        try {
            await sendMessage('ADD_DOMAIN', { domain });
            input.value = '';
            await loadBlacklist();
        } catch (e) {
            alert(SWI18n.t('failedAddDomain', [e.message]));
        } finally {
            $('add-domain-btn').disabled = false;
            $('add-domain-btn').textContent = SWI18n.t('add');
        }
    });

    $('new-domain').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') $('add-domain-btn').click();
    });

    // ===== Settings Toggles =====
    ['blacklist', 'sidebar', 'highlight'].forEach(key => {
        $(`opt-${key}`).addEventListener('change', async (e) => {
            await chrome.storage.sync.set({
                [`${key}_enabled`]: e.target.checked,
            });
        });
    });

    $('opt-language').addEventListener('change', async (e) => {
        await chrome.storage.sync.set({ language: e.target.value });
        await SWI18n.init();
        document.title = SWI18n.t('settingsTitle');
        SWI18n.apply();
        renderBlacklist();
        updateAccountUI();
    });

    // ===== Auth (Account Section) =====
    $('opt-login-btn').addEventListener('click', async () => {
        const email = $('opt-login-email').value.trim();
        const password = $('opt-login-password').value;
        const errorEl = $('opt-login-error');

        if (!email || !password) {
            errorEl.textContent = SWI18n.t('fillAllFields');
            errorEl.style.display = '';
            return;
        }

        $('opt-login-btn').disabled = true;
        errorEl.style.display = 'none';

        try {
            const response = await sendMessage('LOGIN', { email, password });
            currentUser = response.user;
            updateAccountUI();
            await loadBlacklist();
        } catch (e) {
            errorEl.textContent = e.message || SWI18n.t('loginFailed');
            errorEl.style.display = '';
        } finally {
            $('opt-login-btn').disabled = false;
        }
    });

    $('opt-register-btn').addEventListener('click', async () => {
        const name = $('opt-register-name').value.trim();
        const email = $('opt-register-email').value.trim();
        const password = $('opt-register-password').value;
        const confirm = $('opt-register-confirm').value;
        const errorEl = $('opt-register-error');

        if (!name || !email || !password || !confirm) {
            errorEl.textContent = SWI18n.t('fillAllFields');
            errorEl.style.display = '';
            return;
        }

        if (password !== confirm) {
            errorEl.textContent = SWI18n.t('passwordsDoNotMatch');
            errorEl.style.display = '';
            return;
        }

        if (password.length < 8) {
            errorEl.textContent = SWI18n.t('passwordMinLength');
            errorEl.style.display = '';
            return;
        }

        $('opt-register-btn').disabled = true;
        errorEl.style.display = 'none';

        try {
            const response = await sendMessage('REGISTER', {
                name, email, password, password_confirmation: confirm,
            });
            currentUser = response.user;
            updateAccountUI();
        } catch (e) {
            errorEl.textContent = e.message || SWI18n.t('registrationFailed');
            errorEl.style.display = '';
        } finally {
            $('opt-register-btn').disabled = false;
        }
    });

    $('opt-logout-btn').addEventListener('click', async () => {
        await sendMessage('LOGOUT');
        currentUser = null;
        updateAccountUI();
        await loadBlacklist();
    });

    // ===== Subscription =====
    $('upgrade-monthly-btn').addEventListener('click', async () => {
        try {
            const result = await sendMessage('CHECKOUT', { plan: 'monthly' });
            if (result?.checkout_url) {
                chrome.tabs.create({ url: result.checkout_url });
            }
        } catch (e) {
            alert(SWI18n.t('failedCheckout', [e.message]));
        }
    });

    $('upgrade-yearly-btn').addEventListener('click', async () => {
        try {
            const result = await sendMessage('CHECKOUT', { plan: 'yearly' });
            if (result?.checkout_url) {
                chrome.tabs.create({ url: result.checkout_url });
            }
        } catch (e) {
            alert(SWI18n.t('failedCheckout', [e.message]));
        }
    });

    $('manage-sub-btn').addEventListener('click', async () => {
        try {
            const result = await sendMessage('BILLING_PORTAL');
            if (result?.portal_url) {
                chrome.tabs.create({ url: result.portal_url });
            }
        } catch (e) {
            alert(SWI18n.t('failedBillingPortal', [e.message]));
        }
    });

    // ===== Helpers =====
    function sendMessage(type, data = {}) {
        return new Promise((resolve, reject) => {
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
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // Init
    init();
})();
