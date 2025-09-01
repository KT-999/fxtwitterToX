document.addEventListener("DOMContentLoaded", () => {
    const toggleSwitch = document.getElementById("toggleSwitch");
    const statusText = document.getElementById("statusText");

    // 更新顯示的文字和顏色
    function updateStatus(isEnabled) {
        statusText.textContent = isEnabled ? "ON" : "OFF";
        statusText.className = isEnabled ? "status-text on" : "status-text off";
    }

    // 從 storage 讀取目前的狀態，並設定開關和文字
    browser.storage.local.get("enabled").then((result) => {
        const isEnabled = result.enabled !== false;
        toggleSwitch.checked = isEnabled;
        updateStatus(isEnabled);
    });

    // 監聽開關的變動
    toggleSwitch.addEventListener("change", () => {
        const isEnabled = toggleSwitch.checked;
        updateStatus(isEnabled);
        // 傳送訊息到 background.js 來更新狀態
        browser.runtime.sendMessage({
            action: "toggleRedirect",
            enabled: isEnabled,
        });
    });
});

