/**
 * 這個 Content Script 會根據 storage 中的設定來決定是否執行特定功能。
 */

function runFxTwitterLinkReplacer() {
    function replaceLinksInElement(element) {
        if (element.nodeType !== Node.ELEMENT_NODE) return;
        const links = element.querySelectorAll('a[href*="fxtwitter.com"], a[href*="vxtwitter.com"]');
        links.forEach(link => {
            if (link.href) {
                link.href = link.href.replace(/fxtwitter\.com/g, 'x.com').replace(/vxtwitter\.com/g, 'x.com');
            }
        });
    }
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    replaceLinksInElement(node);
                });
            }
        }
    });
    replaceLinksInElement(document.body);
    observer.observe(document.body, { childList: true, subtree: true });
}

function runYoutubeAudioOnlyMode(settings) {
    if (!window.location.hostname.includes('youtube.com')) return;

    // 注入 CSS 來直接隱藏所有種類的預覽播放器
    const styleId = 'audio-only-preview-blocker';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        // 新增了 animated-thumbnail-overlay-view-model 規則來處理您發現的最新預覽播放器
        style.textContent = `
            /* 隱藏現代網格/列表檢視中的懸停播放器 */
            ytd-video-preview #player-container {
                display: none !important;
            }
            /* 隱藏用於側邊欄和舊版面配置的浮動影片預覽播放器 */
            #video-preview {
                display: none !important;
            }
            /* 隱藏推薦欄位和舊版面配置中的動畫縮圖播放器 */
            animated-thumbnail-overlay-view-model {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }


    // 處理主播放頁面的邏輯
    function modifyPlayer() {
        const playerContainer = document.querySelector('#movie_player');
        if (!playerContainer) return;

        const videoElement = playerContainer.querySelector('video');
        if (videoElement) videoElement.remove();

        if (playerContainer.querySelector('.audio-only-overlay')) return;

        playerContainer.style.backgroundColor = 'black';
        const overlay = document.createElement('div');
        overlay.className = 'audio-only-overlay';
        Object.assign(overlay.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'black', zIndex: '10', pointerEvents: 'auto' });

        if (settings.youtubeDisplayMode === 'thumbnail') {
            const thumbnailUrl = document.querySelector('meta[property="og:image"]')?.content;
            if (thumbnailUrl) {
                const img = document.createElement('img');
                img.src = thumbnailUrl;
                Object.assign(img.style, { width: '100%', height: '100%', objectFit: 'contain' });
                overlay.appendChild(img);
            } else {
                overlay.textContent = '🎧 純音訊模式已啟用 (找不到封面)';
                overlay.style.color = 'white';
                overlay.style.fontSize = '24px';
            }
        } else {
            overlay.textContent = '🎧 純音訊模式已啟用';
            overlay.style.color = 'white';
            overlay.style.fontSize = '24px';
        }
        playerContainer.appendChild(overlay);
    }

    const observer = new MutationObserver(modifyPlayer);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('yt-navigate-finish', modifyPlayer);
    modifyPlayer();
}

function main() {
    browser.storage.local.get('featureSettings').then((result) => {
        const settings = result.featureSettings;
        if (!settings) return;

        if (settings.fxtwitter) {
            runFxTwitterLinkReplacer();
        }
        if (settings.youtubeAudioOnly) {
            runYoutubeAudioOnlyMode(settings);
        }
    });
}

main();

