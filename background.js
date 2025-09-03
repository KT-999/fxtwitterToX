// 預設功能設定
const defaultSettings = {
    fxtwitter: true,
    youtubeAudioOnly: false,
    youtubeDisplayMode: 'text' // 'text' or 'thumbnail'
};

// 網路請求攔截規則的 ID
const YOUTUBE_VIDEO_RULE_ID = 1;
const YOUTUBE_STORYBOARD_RULE_ID = 2;

// 更新 YouTube 純音訊模式的攔截規則
function updateYoutubeAudioOnlyRules(enabled) {
    const rules = [{
        id: YOUTUBE_VIDEO_RULE_ID,
        priority: 1,
        action: { type: 'block' },
        condition: {
            urlFilter: '*://*.googlevideo.com/videoplayback*',
            resourceTypes: ['media']
        }
    }, {
        id: YOUTUBE_STORYBOARD_RULE_ID,
        priority: 1,
        action: { type: 'block' },
        condition: {
            urlFilter: '*://i.ytimg.com/*/storyboard*',
            resourceTypes: ['image']
        }
    }];

    if (enabled) {
        // 新增規則以阻擋影片和預覽圖
        browser.declarativeNetRequest.updateDynamicRules({
            addRules: rules
        });
    } else {
        // 移除規則
        browser.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [YOUTUBE_VIDEO_RULE_ID, YOUTUBE_STORYBOARD_RULE_ID]
        });
    }
}

// 附加元件安裝或更新時，初始化設定
browser.runtime.onInstalled.addListener(() => {
    browser.storage.local.get('featureSettings').then((result) => {
        let settings = result.featureSettings;
        if (!settings) {
            settings = defaultSettings;
            browser.storage.local.set({ featureSettings: settings });
        }
        updateYoutubeAudioOnlyRules(settings.youtubeAudioOnly);
    });
});

// 監聽來自 popup 的設定變更訊息
browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'updateSetting') {
        browser.storage.local.get('featureSettings').then((result) => {
            let settings = result.featureSettings || defaultSettings;
            settings[message.key] = message.value;
            browser.storage.local.set({ featureSettings: settings }).then(() => {
                // 如果是 YouTube 音訊模式的變更，則更新網路請求規則
                if (message.key === 'youtubeAudioOnly') {
                    updateYoutubeAudioOnlyRules(message.value);
                }
            });
        });
    }
});

// --- 網路流量監控 ---
const dataUsageByTab = {};
let activePorts = {};

// 監聽網路請求完成事件
browser.webRequest.onCompleted.addListener(
    (details) => {
        const tabId = details.tabId;
        if (tabId > 0 && details.responseHeaders) {
            const contentLengthHeader = details.responseHeaders.find(
                (header) => header.name.toLowerCase() === 'content-length'
            );
            if (contentLengthHeader && contentLengthHeader.value) {
                const size = parseInt(contentLengthHeader.value, 10);
                if (!isNaN(size)) {
                    dataUsageByTab[tabId] = (dataUsageByTab[tabId] || 0) + size;
                    // 如果有開啟的 popup 連線，即時推送更新
                    if (activePorts[tabId]) {
                        activePorts[tabId].postMessage({
                            action: 'dataUsageUpdate',
                            usage: dataUsageByTab[tabId]
                        });
                    }
                }
            }
        }
    }, { urls: ['<all_urls>'] },
    ['responseHeaders']
);

// 監聽分頁更新事件，重置流量計數
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
        dataUsageByTab[tabId] = 0;
    }
});

// 監聽分頁關閉事件，清除資料
browser.tabs.onRemoved.addListener((tabId) => {
    delete dataUsageByTab[tabId];
    delete activePorts[tabId];
});


// 監聽來自 popup 的長期連線
browser.runtime.onConnect.addListener((port) => {
    if (port.name === 'data_usage_port') {
        let tabId;

        // 接收 popup 傳來的 tabId
        port.onMessage.addListener((message) => {
            if (message.action === 'register' && message.tabId) {
                tabId = message.tabId;
                activePorts[tabId] = port;

                // 立即傳送目前的流量數據
                port.postMessage({
                    action: 'dataUsageUpdate',
                    usage: dataUsageByTab[tabId] || 0
                });
            }
        });

        // 當連線中斷時
        port.onDisconnect.addListener(() => {
            if (tabId) {
                delete activePorts[tabId];
            }
        });
    }
});

