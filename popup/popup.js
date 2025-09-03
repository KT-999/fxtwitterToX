document.addEventListener('DOMContentLoaded', () => {
    const settings = {
        'toggle-fxtwitter': 'fxtwitter',
        'toggle-youtubeAudioOnly': 'youtubeAudioOnly'
    };

    // 初始化 popup 介面
    browser.storage.local.get('featureSettings').then((result) => {
        const currentSettings = result.featureSettings || {};
        for (const [id, key] of Object.entries(settings)) {
            const toggle = document.getElementById(id);
            if (toggle) {
                toggle.checked = currentSettings[key] !== false; // 預設為 true
            }
        }

        // 特別處理 YouTube 顯示模式
        const displayMode = currentSettings.youtubeDisplayMode || 'text';
        const displayModeButton = document.getElementById(`display-mode-${displayMode}`);
        if (displayModeButton) {
            displayModeButton.classList.add('active');
        }

        // 根據 YouTube 純音訊模式的開關，決定是否顯示選項
        const youtubeOptions = document.getElementById('youtube-options');
        if (youtubeOptions) {
            youtubeOptions.style.display = currentSettings.youtubeAudioOnly ? 'flex' : 'none';
        }
    });

    // 監聽所有開關的變動
    for (const [id, key] of Object.entries(settings)) {
        const toggle = document.getElementById(id);
        if (toggle) {
            toggle.addEventListener('change', () => {
                const value = toggle.checked;
                browser.runtime.sendMessage({ action: 'updateSetting', key: key, value: value });

                // 如果是 YouTube 的開關，則顯示/隱藏其選項
                if (key === 'youtubeAudioOnly') {
                    const youtubeOptions = document.getElementById('youtube-options');
                    if (youtubeOptions) {
                        youtubeOptions.style.display = value ? 'flex' : 'none';
                    }
                }
            });
        }
    }

    // 監聽 YouTube 顯示模式按鈕的點擊
    const displayButtons = document.querySelectorAll('.display-mode-btn');
    displayButtons.forEach(button => {
        button.addEventListener('click', () => {
            displayButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const mode = button.dataset.mode;
            browser.runtime.sendMessage({ action: 'updateSetting', key: 'youtubeDisplayMode', value: mode });
        });
    });

    // --- 網路流量即時更新 ---
    const dataUsageElement = document.getElementById('data-usage-value');
    if (dataUsageElement) {
        const port = browser.runtime.connect({ name: 'data_usage_port' });

        // 告訴 background script 我們是哪個分頁
        browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            if (tabs[0]) {
                port.postMessage({ action: 'register', tabId: tabs[0].id });
            }
        });

        // 監聽來自 background script 的更新
        port.onMessage.addListener((message) => {
            if (message.action === 'dataUsageUpdate') {
                const megabytes = (message.usage / (1024 * 1024)).toFixed(2);
                dataUsageElement.textContent = `${megabytes} MB`;
            }
        });
    }
});

