document.addEventListener('DOMContentLoaded', () => {
    const featureToggles = document.querySelectorAll('.toggle-switch input[type="checkbox"]');
    const youtubeToggle = document.getElementById('toggle-youtubeAudioOnly');
    const youtubeOptions = document.getElementById('youtube-display-options');
    const youtubeDisplayRadios = document.querySelectorAll('input[name="youtube-display"]');
    const dataUsageDisplay = document.getElementById('data-usage-display');

    function updateSetting(key, value) {
        browser.runtime.sendMessage({ action: 'updateSetting', key, value });
    }

    function updateYoutubeOptionsVisibility() {
        if (youtubeToggle.checked) {
            youtubeOptions.classList.remove('hidden');
        } else {
            youtubeOptions.classList.add('hidden');
        }
    }

    browser.storage.local.get('featureSettings').then((result) => {
        const settings = result.featureSettings || {};
        featureToggles.forEach(toggle => {
            const featureName = toggle.id.replace('toggle-', '');
            toggle.checked = settings[featureName] === true;
        });
        const displayMode = settings.youtubeDisplayMode || 'text';
        document.querySelector(`input[name="youtube-display"][value="${displayMode}"]`).checked = true;
        updateYoutubeOptionsVisibility();
    });

    featureToggles.forEach(toggle => {
        toggle.addEventListener('change', () => {
            const featureName = toggle.id.replace('toggle-', '');
            updateSetting(featureName, toggle.checked);
        });
    });

    youtubeToggle.addEventListener('change', updateYoutubeOptionsVisibility);

    youtubeDisplayRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) {
                updateSetting('youtubeDisplayMode', radio.value);
            }
        });
    });

    // --- 即時網路流量顯示 ---
    function formatBytes(bytes, decimals = 2) {
        if (!Number.isFinite(bytes) || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    // 查詢目前的分頁 ID
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs && tabs.length > 0) {
            const currentTabId = tabs[0].id;
            
            // 建立與背景腳本的長連線
            const port = browser.runtime.connect({ name: 'data-usage-port' });

            // **第一件事：告訴背景腳本我們是誰**
            port.postMessage({ action: 'register', tabId: currentTabId });

            // 監聽來自背景腳本的流量更新訊息
            port.onMessage.addListener((message) => {
                if (message.action === 'updateUsage') {
                    if (dataUsageDisplay) {
                        dataUsageDisplay.textContent = formatBytes(message.usage);
                    }
                }
            });
        }
    });
});

