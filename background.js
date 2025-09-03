// 預設的功能設定
const defaultSettings = {
    fxtwitter: true,
    youtubeAudioOnly: false,
    youtubeDisplayMode: 'text' // 'text' 或 'thumbnail'
};

let currentSettings = {};
let tabDataUsage = {};
let popupPorts = {}; // 儲存與 popup 的連線，以 tabId 為 key

// 定義網路請求規則的 ID
const YOUTUBE_VIDEO_RULE_ID = 1;
const YOUTUBE_STORYBOARD_RULE_ID = 2;

// 更新 YouTube 純音訊模式的網路請求規則
async function updateYoutubeAudioOnlyRules(enabled) {
    if (enabled) {
        browser.declarativeNetRequest.updateDynamicRules({
            addRules: [
                { id: YOUTUBE_VIDEO_RULE_ID, priority: 1, action: { type: 'block' }, condition: { requestDomains: ["googlevideo.com"], regexFilter: 'mime=video', resourceTypes: ['media'] } },
                { id: YOUTUBE_STORYBOARD_RULE_ID, priority: 1, action: { type: 'block' }, condition: { requestDomains: ["i.ytimg.com"], regexFilter: 'storyboard', resourceTypes: ['image'] } }
            ],
            removeRuleIds: [YOUTUBE_VIDEO_RULE_ID, YOUTUBE_STORYBOARD_RULE_ID]
        });
    } else {
        browser.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [YOUTUBE_VIDEO_RULE_ID, YOUTUBE_STORYBOARD_RULE_ID]
        });
    }
}

// 初始化：從 storage 讀取設定
function initializeSettings() {
    browser.storage.local.get('featureSettings').then((result) => {
        currentSettings = Object.assign({}, defaultSettings, result.featureSettings);
        browser.storage.local.set({ featureSettings: currentSettings });
        updateYoutubeAudioOnlyRules(currentSettings.youtubeAudioOnly);
    });
}

// 流量監控
browser.webRequest.onHeadersReceived.addListener(
    (details) => {
        if (details.tabId > 0 && details.responseHeaders) {
            const contentLengthHeader = details.responseHeaders.find(header => header.name.toLowerCase() === 'content-length');
            if (contentLengthHeader && contentLengthHeader.value) {
                const bytes = parseInt(contentLengthHeader.value, 10);
                if (!isNaN(bytes)) {
                    tabDataUsage[details.tabId] = (tabDataUsage[details.tabId] || 0) + bytes;
                    // 如果有與此分頁對應的 popup 連線，立即傳送更新
                    if (popupPorts[details.tabId]) {
                        popupPorts[details.tabId].postMessage({
                            action: 'updateUsage',
                            usage: tabDataUsage[details.tabId]
                        });
                    }
                }
            }
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
);

// 分頁事件監聽
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
        tabDataUsage[tabId] = 0;
    }
});

browser.tabs.onRemoved.addListener((tabId) => {
    delete tabDataUsage[tabId];
    if (popupPorts[tabId]) {
        delete popupPorts[tabId];
    }
});

// 監聽來自 popup 的長連線
browser.runtime.onConnect.addListener((port) => {
    if (port.name === 'data-usage-port') {
        let tabId = null;

        const messageListener = (message) => {
            // 等待 popup 傳送 "register" 訊息來註冊自己
            if (message.action === 'register' && message.tabId) {
                tabId = message.tabId;
                popupPorts[tabId] = port; // 將這個連線與 tabId 關聯起來

                // 註冊成功後，立即回傳目前的流量數據
                port.postMessage({
                    action: 'updateUsage',
                    usage: tabDataUsage[tabId] || 0
                });
            }
        };
        
        port.onMessage.addListener(messageListener);

        port.onDisconnect.addListener(() => {
            if (tabId !== null) {
                delete popupPorts[tabId];
            }
            port.onMessage.removeListener(messageListener); // 清理監聽器
        });
    }
});


// 監聽來自 popup 的一次性訊息
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateSetting') {
        currentSettings[message.key] = message.value;
        browser.storage.local.set({ featureSettings: currentSettings });
    }
    return true;
});

// 監聽 storage 的設定變更
browser.storage.onChanged.addListener((changes) => {
    if (changes.featureSettings) {
        const newSettings = changes.featureSettings.newValue;
        const oldSettings = changes.featureSettings.oldValue || {};
        currentSettings = newSettings;
        if (newSettings.youtubeAudioOnly !== oldSettings.youtubeAudioOnly) {
            updateYoutubeAudioOnlyRules(newSettings.youtubeAudioOnly);
        }
    }
});

// FX/VX Twitter 網址導航功能
browser.webNavigation.onBeforeNavigate.addListener(
    (details) => {
        if (currentSettings.fxtwitter && (details.url.includes("fxtwitter.com") || details.url.includes("vxtwitter.com"))) {
            const newUrl = details.url.replace("fxtwitter.com", "x.com").replace("vxtwitter.com", "x.com");
            browser.tabs.update(details.tabId, { url: newUrl });
        }
    },
    { url: [{ hostContains: "fxtwitter.com" }, { hostContains: "vxtwitter.com" }] }
);

// 啟動附加元件時初始化
initializeSettings();

