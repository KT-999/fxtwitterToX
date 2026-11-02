document.addEventListener('DOMContentLoaded', () => {
    // 顯示附加元件版本號
    try {
        const manifest = browser.runtime.getManifest();
        const version = manifest.version || '1.0';
        const versionBadge = document.getElementById('extension-version');
        const versionFooter = document.getElementById('version-footer');

        if (versionBadge) {
            versionBadge.textContent = `v${version}`;
        }
        if (versionFooter) {
            versionFooter.textContent = `版本 ${version}`;
        }
    } catch (e) {
        console.error('Failed to get manifest version:', e);
    }

    const settings = {
        'toggle-fxtwitter': 'fxtwitter',
        'toggle-youtubeAudioOnly': 'youtubeAudioOnly',
        'toggle-youtubeCustomGrid': 'youtubeCustomGrid',
        'toggle-youtubeShowLiveViewers': 'youtubeShowLiveViewers'
    };

    // 初始化 popup 介面
    browser.storage.local.get('featureSettings').then((result) => {
        const currentSettings = result.featureSettings || {};
        for (const [id, key] of Object.entries(settings)) {
            const toggle = document.getElementById(id);
            if (toggle) {
                // 如果是新功能，預設值處理
                if (key === 'youtubeCustomGrid' || key === 'youtubeShowLiveViewers') {
                    toggle.checked = Boolean(currentSettings[key]);
                } else {
                    toggle.checked = currentSettings[key] !== false; // 預設為 true 或 false 依原本邏輯
                }
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

        // 根據 YouTube 每行影片數開關，決定是否顯示選項
        const youtubeGridOptions = document.getElementById('youtube-grid-options');
        if (youtubeGridOptions) {
            youtubeGridOptions.style.display = currentSettings.youtubeCustomGrid ? 'flex' : 'none';
        }

        // 標記目前每行影片數按鈕
        const videosPerRow = currentSettings.youtubeVideosPerRow || 5;
        const currentCountBtn = document.querySelector(`.row-count-btn[data-count="${videosPerRow}"]`);
        if (currentCountBtn) {
            currentCountBtn.classList.add('active');
        } else {
            const defaultCountBtn = document.querySelector('.row-count-btn[data-count="5"]');
            if (defaultCountBtn) defaultCountBtn.classList.add('active');
        }
    });

    // 監聽所有開關的變動
    for (const [id, key] of Object.entries(settings)) {
        const toggle = document.getElementById(id);
        if (toggle) {
            toggle.addEventListener('change', () => {
                const value = toggle.checked;
                browser.runtime.sendMessage({ action: 'updateSetting', key: key, value: value });

                // 如果是 YouTube 純音訊開關，則顯示/隱藏其選項
                if (key === 'youtubeAudioOnly') {
                    const youtubeOptions = document.getElementById('youtube-options');
                    if (youtubeOptions) {
                        youtubeOptions.style.display = value ? 'flex' : 'none';
                    }
                }

                // 如果是 YouTube 每行影片數開關，則顯示/隱藏其選項
                if (key === 'youtubeCustomGrid') {
                    const youtubeGridOptions = document.getElementById('youtube-grid-options');
                    if (youtubeGridOptions) {
                        youtubeGridOptions.style.display = value ? 'flex' : 'none';
                    }
                }
            });
        }
    }

    // 監聽 YouTube 每行數量按鈕的點擊
    const rowCountButtons = document.querySelectorAll('.row-count-btn');
    rowCountButtons.forEach(button => {
        button.addEventListener('click', () => {
            rowCountButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const count = parseInt(button.dataset.count, 10);
            browser.runtime.sendMessage({ action: 'updateSetting', key: 'youtubeVideosPerRow', value: count });
        });
    });

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
