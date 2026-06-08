// SearchWise - Options Page Script
(function () {
    'use strict';

    const $ = id => document.getElementById(id);
    let userDomains = [];
    let allowedDomains = [];
    let defaultDomains = [];
    let sharingBonusUnlocked = false;

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

        await maybeShowOnboarding();

        const settings = await chrome.storage.sync.get({
            blacklist_enabled: true,
            highlight_enabled: true,
            language: 'auto',
            filter_mode: 'hide',
            sharing_bonus_unlocked: false,
        });

        sharingBonusUnlocked = settings.sharing_bonus_unlocked;
        $('opt-blacklist').checked = settings.blacklist_enabled;
        $('opt-highlight').checked = settings.highlight_enabled;
        $('opt-language').value = settings.language || 'auto';
        $('opt-filter-mode').value = settings.filter_mode || 'hide';

        await loadStats();
        await loadBlacklist();
    }

    async function maybeShowOnboarding() {
        const data = await chrome.storage.local.get({ onboarding_pending: false });
        const shouldShow = data.onboarding_pending || location.hash === '#welcome';
        if (!shouldShow) return;

        const card = $('onboarding-card');
        card.style.display = '';
        $('dismiss-onboarding').addEventListener('click', async () => {
            card.style.display = 'none';
            await chrome.storage.local.set({ onboarding_pending: false });
            if (location.hash === '#welcome') history.replaceState(null, '', location.pathname);
        }, { once: true });
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
                allowedDomains = response.allowed_domains || [];
                defaultDomains = response.default_domains || [];
                renderBlacklist();
            }
        } catch (e) {
            const data = await chrome.storage.local.get('blacklist_domains');
            defaultDomains = (data.blacklist_domains || []).map(d => ({
                domain: d, source: 'default',
            }));
            allowedDomains = [];
            renderBlacklist();
        }
    }

    function renderBlacklist() {
        const limitText = $('domain-limit-text');

        renderDomainList('blocked-domain-list', userDomains, {
            emptyText: SWI18n.t('noBlockedDomains'),
            sourceLabel: () => SWI18n.t('customLabel'),
            removable: true,
            removeMessage: 'REMOVE_DOMAIN',
        });
        renderDomainList('allowed-domain-list', allowedDomains, {
            emptyText: SWI18n.t('noAllowedDomains'),
            sourceLabel: () => SWI18n.t('allowedLabel'),
            removable: true,
            removeMessage: 'REMOVE_ALLOWED_DOMAIN',
        });
        renderDomainList('default-domain-list', defaultDomains, {
            emptyText: SWI18n.t('noBuiltInRules'),
            sourceLabel: d => ruleSourceLabel(d.category || d.label),
            removable: false,
        });

        const limit = sharingBonusUnlocked ? 50 : 20;
        $('stat-custom-blocks').textContent = `${userDomains.length}/${limit}`;
        limitText.textContent = SWI18n.t('customDomainsLimit', [
            String(userDomains.length),
            String(limit),
            '',
        ]);

        const descEl = $('backup-share-desc');
        if (descEl) {
            descEl.innerHTML = sharingBonusUnlocked ? 
                SWI18n.t('backupAndShareDescUnlocked') : 
                SWI18n.t('backupAndShareDescLocked');
        }
    }

    function renderDomainList(listId, domains, options) {
        const list = $(listId);
        if (!domains.length) {
            list.innerHTML = `<div class="sw-empty-state">${escapeHtml(options.emptyText)}</div>`;
            return;
        }

        list.innerHTML = domains.map(d => `
            <div class="sw-domain-item">
                <div>
                    <span class="sw-domain-name">${escapeHtml(d.domain)}</span>
                    <span class="sw-domain-source">(${escapeHtml(options.sourceLabel(d))})</span>
                </div>
                ${options.removable ? `<button class="sw-domain-remove" data-id="${escapeHtml(d.id)}" data-domain="${escapeHtml(d.domain)}" title="${SWI18n.t('close')}">&times;</button>` : ''}
            </div>
        `).join('');

        if (!options.removable) return;

        list.querySelectorAll('.sw-domain-remove').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const domain = btn.dataset.domain;
                try {
                    await sendMessage(options.removeMessage, { id, domain });
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

    $('opt-filter-mode').addEventListener('change', async (e) => {
        await chrome.storage.sync.set({ filter_mode: e.target.value });
    });

    $('btn-export-config').addEventListener('click', async () => {
        if (!userDomains.length) {
            alert(SWI18n.t('noBlockedDomainsToExport') || '您还没有任何自定义屏蔽域名可以导出。');
            return;
        }
        try {
            const domains = userDomains.map(d => d.domain);
            const shareToken = btoa(JSON.stringify(domains));
            
            // Try to write to clipboard
            try {
                await navigator.clipboard.writeText(shareToken);
            } catch (clipErr) {
                console.warn('Clipboard write failed', clipErr);
            }
            
            // Unlock sharing bonus!
            if (!sharingBonusUnlocked) {
                sharingBonusUnlocked = true;
                await chrome.storage.sync.set({ sharing_bonus_unlocked: true });
                renderBlacklist();
                await loadStats();
            }
            
            prompt(
                (SWI18n.t('exportSuccessPrompt') || '导出成功！分享配置代码已复制到剪贴板（若自动复制失败，请手动复制下方框内的文本）：'),
                shareToken
            );
        } catch (e) {
            alert('导出失败: ' + e.message);
        }
    });

    $('btn-import-config').addEventListener('click', async () => {
        const pasted = prompt(SWI18n.t('pasteShareCode') || '请粘贴分享配置代码（Base64 字符串）：');
        if (!pasted) return;
        try {
            const cleaned = pasted.trim();
            const domains = JSON.parse(atob(cleaned));
            if (!Array.isArray(domains)) {
                throw new Error('Invalid backup format');
            }
            
            // Validate domains
            const validDomains = domains.filter(d => typeof d === 'string' && d.trim().length > 0);
            if (!validDomains.length) {
                alert(SWI18n.t('noValidDomains') || '配置中未发现有效的域名。');
                return;
            }
            
            const result = await sendMessage('IMPORT_DOMAINS', { domains: validDomains });
            await loadBlacklist();
            alert((SWI18n.t('importSuccess') || '导入成功！已成功导入 $COUNT$ 个网站规则。').replace('$COUNT$', result.addedCount));
        } catch (e) {
            alert((SWI18n.t('importFailed') || '导入失败，请检查分享代码是否完整或正确。') + ' (' + e.message + ')');
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

    function ruleSourceLabel(category) {
        const labels = {
            content_farm: SWI18n.t('ruleCategoryContentFarm'),
            cn_mirror: SWI18n.t('ruleCategoryCnMirror'),
            low_signal_tutorial: SWI18n.t('ruleCategoryLowSignalTutorial'),
            qa_noise: SWI18n.t('ruleCategoryQaNoise'),
            developer_rule: SWI18n.t('defaultLabel'),
        };
        return labels[category] || SWI18n.t('defaultLabel');
    }

    init();
})();
