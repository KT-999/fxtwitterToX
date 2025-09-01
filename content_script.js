/**
 * 這個腳本會主動尋找頁面中所有指向 fxtwitter.com 的連結，
 * 並將它們的網址直接修改為 x.com。
 * 它同時會監聽頁面的動態變化（例如無限滾動加載的新內容），
 * 以確保新出現的連結也能被即時轉換。
 */

// 定義一個函數，用來替換指定元素內部的連結
function replaceLinksInElement(element) {
    // 只處理有效的元素節點
    if (element.nodeType !== Node.ELEMENT_NODE) {
        return;
    }

    // 尋找所有 href 屬性包含 "fxtwitter.com" 的 <a> 標籤
    const links = element.querySelectorAll('a[href*="fxtwitter.com"]');

    links.forEach(link => {
        // 再次確認 href 存在，然後執行替換
        if (link.href) {
            link.href = link.href.replace(/fxtwitter\.com/g, 'x.com');
        }
    });
}

// 建立一個 MutationObserver 來監聽 DOM 的變化
const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        // 當有新的節點被新增到頁面時
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach(node => {
                // 對每一個新節點，執行連結替換函數
                replaceLinksInElement(node);
            });
        }
    }
});

// 首次載入時，先對整個 body 執行一次連結替換
replaceLinksInElement(document.body);

// 開始監聽整個 body 的子節點變化（包含深層的子節點）
observer.observe(document.body, {
    childList: true,
    subtree: true
});

