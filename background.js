// 預設為開啟功能
let isEnabled = true;

// 啟動時從 storage 讀取設定
browser.storage.local.get("enabled").then((result) => {
    if (result.enabled !== undefined) {
        isEnabled = result.enabled;
    }
});

// 監聽網址導航事件
browser.webNavigation.onBeforeNavigate.addListener(
    (details) => {
        // 如果功能未開啟或網址不是 fxtwitter.com，則不執行
        if (!isEnabled || !details.url.includes("fxtwitter.com")) {
            return;
        }

        // 取得新的網址
        const newUrl = details.url.replace("fxtwitter.com", "x.com");

        // 執行重新導向
        browser.tabs.update(details.tabId, { url: newUrl });
    },
    { url: [{ hostContains: "fxtwitter.com" }] }
);

// 監聽來自 popup 的訊息，用來開關功能
browser.runtime.onMessage.addListener((message) => {
    if (message.action === "toggleRedirect") {
        isEnabled = message.enabled;
        // 將新設定儲存到 storage
        browser.storage.local.set({ enabled: isEnabled });
    }
});
