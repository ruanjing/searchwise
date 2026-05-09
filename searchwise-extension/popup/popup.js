// SearchWise - Popup Script
(function () {
    'use strict';

    const $ = id => document.getElementById(id);

    // ===== Init =====
    async function init() {
        await SWI18n.init();
        SWI18n.apply();
        await chrome.storage.local.remove([SW.STORAGE.AUTH_TOKEN, SW.STORAGE.USER_INFO]);

        $('user-name').textContent = SWI18n.t('localModeName');
        $('user-email').textContent = SWI18n.t('localModeDesc');
        $('plan-badge').textContent = SWI18n.t('freePlan');
        $('plan-badge').classList.remove('pro');

        const settings = await chrome.storage.sync.get({
            blacklist_enabled: true,
            highlight_enabled: true,
        });
        $('toggle-blacklist').checked = settings.blacklist_enabled;
        $('toggle-highlight').checked = settings.highlight_enabled;

        try {
            const response = await sendMessage('FETCH_BLACKLIST');
            $('usage-domains').textContent = `${(response?.user_domains || []).length}/${SW.LIMITS.LOCAL_FREE_DOMAINS}`;
        } catch (e) {
            $('usage-domains').textContent = `0/${SW.LIMITS.LOCAL_FREE_DOMAINS}`;
        }
    }

    // ===== Settings toggles =====
    ['blacklist', 'highlight'].forEach(key => {
        $(`toggle-${key}`).addEventListener('change', async (e) => {
            await chrome.storage.sync.set({
                [`${key}_enabled`]: e.target.checked,
            });
        });
    });

    $('settings-btn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

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

    init();
})();
