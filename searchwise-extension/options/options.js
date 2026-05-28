// SearchWise - Options Page Script
(function () {
    'use strict';

    const $ = id => document.getElementById(id);
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

        const settings = await chrome.storage.sync.get({
            blacklist_enabled: true,
            highlight_enabled: true,
            language: 'auto',
        });

        $('opt-blacklist').checked = settings.blacklist_enabled;
        $('opt-highlight').checked = settings.highlight_enabled;
        $('opt-language').value = settings.language || 'auto';

        await loadStats();
        await loadBlacklist();
    }

    async function loadStats() {
        const today = new Date().toISOString().slice(0, 10);
        const data = await chrome.storage.local.get({
            sw_stats: { totalFiltered: 0, dailyFiltered: {} },
        });
        const stats = data.sw_stats || { totalFiltered: 0, dailyFiltered: {} };
        $('stat-cleaned-today').textContent = String(stats.dailyFiltered?.[today] || 0);
        $('stat-total-cleaned').textContent = String(stats.totalFiltered || 0);
        $('stat-custom-blocks').textContent = `${userDomains.length}/20`;
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
        $('stat-custom-blocks').textContent = `${userDomains.length}/20`;
        limitText.textContent = SWI18n.t('customDomainsLimit', [
            String(userDomains.length),
            '20',
            '',
        ]);

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
    ['blacklist', 'highlight'].forEach(key => {
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
        await loadStats();
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

    init();
})();
