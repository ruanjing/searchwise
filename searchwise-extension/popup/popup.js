// SearchWise - Popup Script
(function () {
    'use strict';

    const $ = id => document.getElementById(id);

    // ===== State =====
    let currentUser = null;

    // ===== Init =====
    async function init() {
        await SWI18n.init();
        SWI18n.apply();

        if (!SW.API_BASE) {
            await chrome.storage.local.remove([SW.STORAGE.AUTH_TOKEN, SW.STORAGE.USER_INFO]);
            showUserSection(localUser());
        } else {
            const data = await chrome.storage.local.get('user_info');
            if (data.user_info) {
            currentUser = data.user_info;
            showUserSection(currentUser);
            } else {
                showUserSection(localUser());
            }
        }

        // Load settings
        const settings = await chrome.storage.sync.get({
            blacklist_enabled: true,
            sidebar_enabled: !!SW.API_BASE,
            highlight_enabled: true,
        });

        $('toggle-blacklist').checked = settings.blacklist_enabled;
        $('toggle-sidebar').checked = settings.sidebar_enabled;
        $('toggle-highlight').checked = settings.highlight_enabled;

        // Try to refresh user data from API
        try {
            if (!SW.API_BASE) return;
            const token = await chrome.storage.local.get(SW.STORAGE.AUTH_TOKEN);
            if (token[SW.STORAGE.AUTH_TOKEN]) {
                const response = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({ type: 'GET_USER' }, (result) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                            return;
                        }
                        resolve(result);
                    });
                });

                if (response && response.user) {
                    currentUser = response.user;
                    showUserSection(currentUser);
                }
            }
        } catch (e) {
            // Offline or token expired — keep cached data
        }
    }

    function localUser() {
        return {
            name: SWI18n.t('localModeName'),
            email: SWI18n.t('localModeDesc'),
            plan: 'free',
            blacklist_count: 0,
            usage_today: { ai_summary: 0 },
            limits: {
                max_domains: SW.LIMITS.LOCAL_FREE_DOMAINS,
                max_ai_summaries_per_day: 0,
            },
            local: true,
        };
    }

    function showUserSection(user) {
        $('auth-section').style.display = 'none';
        $('user-section').style.display = '';

        $('user-name').textContent = user.name || '';
        $('user-email').textContent = user.email || '';

        // Plan badge
        const badge = $('plan-badge');
        if (user.plan === 'pro') {
            badge.textContent = SWI18n.t('proPlan');
            badge.classList.add('pro');
            $('upgrade-btn').style.display = 'none';
        } else {
            badge.textContent = SWI18n.t('freePlan');
            badge.classList.remove('pro');
            $('upgrade-btn').style.display = '';
        }

        // Usage
        if (user.usage_today) {
            const limit = user.limits?.max_ai_summaries_per_day ?? 0;
            $('usage-summaries').textContent = `${user.usage_today.ai_summary || 0}/${limit}`;
        }
        if (user.limits) {
            const domainLimit = user.limits.max_domains || SW.LIMITS.LOCAL_FREE_DOMAINS;
            $('usage-domains').textContent = `${user.blacklist_count || 0}/${domainLimit}`;
        }

        if (!SW.API_BASE || user.local) {
            $('upgrade-btn').style.display = 'none';
            $('logout-btn').style.display = 'none';
            const sidebarRow = $('toggle-sidebar')?.closest('.sw-toggle-row');
            if (sidebarRow) sidebarRow.style.display = 'none';
        }
    }

    function showAuthSection() {
        $('auth-section').style.display = '';
        $('user-section').style.display = 'none';
        currentUser = null;
    }

    // ===== Event Listeners =====

    // Auth form toggling
    $('show-register-btn').addEventListener('click', () => {
        $('login-form').style.display = 'none';
        $('register-form').style.display = '';
    });

    $('show-login-btn').addEventListener('click', () => {
        $('login-form').style.display = '';
        $('register-form').style.display = 'none';
    });

    // Login
    $('login-btn').addEventListener('click', async () => {
        const email = $('login-email').value.trim();
        const password = $('login-password').value;
        const errorEl = $('auth-error');

        if (!email || !password) {
            errorEl.textContent = SWI18n.t('fillAllFields');
            errorEl.style.display = '';
            return;
        }

        $('login-btn').disabled = true;
        $('login-btn').textContent = SWI18n.t('loggingIn');
        errorEl.style.display = 'none';

        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    type: 'LOGIN',
                    data: { email, password },
                }, (result) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (result && result.error) {
                        reject(new Error(result.error));
                        return;
                    }
                    resolve(result);
                });
            });

            currentUser = response.user;
            showUserSection(currentUser);
        } catch (e) {
            errorEl.textContent = e.message || SWI18n.t('loginFailed');
            errorEl.style.display = '';
        } finally {
            $('login-btn').disabled = false;
            $('login-btn').textContent = SWI18n.t('login');
        }
    });

    // Register
    $('register-btn').addEventListener('click', async () => {
        const name = $('register-name').value.trim();
        const email = $('register-email').value.trim();
        const password = $('register-password').value;
        const confirm = $('register-confirm').value;
        const errorEl = $('register-error');

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

        $('register-btn').disabled = true;
        $('register-btn').textContent = SWI18n.t('creatingAccount');
        errorEl.style.display = 'none';

        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    type: 'REGISTER',
                    data: { name, email, password, password_confirmation: confirm },
                }, (result) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    if (result && result.error) {
                        reject(new Error(result.error));
                        return;
                    }
                    resolve(result);
                });
            });

            currentUser = response.user;
            showUserSection(currentUser);
        } catch (e) {
            errorEl.textContent = e.message || SWI18n.t('registrationFailed');
            errorEl.style.display = '';
        } finally {
            $('register-btn').disabled = false;
            $('register-btn').textContent = SWI18n.t('register');
        }
    });

    // Logout
    $('logout-btn').addEventListener('click', async () => {
        await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'LOGOUT' }, resolve);
        });
        showUserSection(localUser());
    });

    // Settings toggles
    ['blacklist', 'sidebar', 'highlight'].forEach(key => {
        $(`toggle-${key}`).addEventListener('change', async (e) => {
            await chrome.storage.sync.set({
                [`${key}_enabled`]: e.target.checked,
            });
        });
    });

    // Settings button
    $('settings-btn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Upgrade button
    $('upgrade-btn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Init
    init();
})();
