/**
 * 這個 Content Script 會根據 storage 中的設定來決定是否執行特定功能。
 */

// ================= FX / VX Twitter 轉址功能 =================
let fxTwitterObserver = null;

function runFxTwitterLinkReplacer() {
    function replaceLinksInElement(element) {
        if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
        const links = element.querySelectorAll('a[href*="fxtwitter.com"], a[href*="vxtwitter.com"]');
        links.forEach(link => {
            if (link.href) {
                link.href = link.href.replace(/fxtwitter\.com/g, 'x.com').replace(/vxtwitter\.com/g, 'x.com');
            }
        });
    }

    if (fxTwitterObserver) {
        fxTwitterObserver.disconnect();
        fxTwitterObserver = null;
    }

    fxTwitterObserver = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    replaceLinksInElement(node);
                });
            }
        }
    });

    replaceLinksInElement(document.body);
    fxTwitterObserver.observe(document.body, { childList: true, subtree: true });
}

// ================= YouTube 純音訊模式 =================
let youtubeAudioObserver = null;

function runYoutubeAudioOnlyMode(settings) {
    if (!window.location.hostname.includes('youtube.com')) return;

    const styleId = 'audio-only-preview-blocker';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            ytd-video-preview #player-container,
            #video-preview,
            animated-thumbnail-overlay-view-model,
            .yt-lockup-view-model__player-container {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    function modifyPlayer() {
        const playerContainer = document.querySelector('#movie_player');
        if (!playerContainer) return;

        const videoElement = playerContainer.querySelector('video');
        if (videoElement) {
            videoElement.style.display = 'none';
        }

        const existingOverlay = playerContainer.querySelector('.audio-only-overlay');
        const videoIdMeta = document.querySelector('meta[itemprop="videoId"]');
        if (existingOverlay && videoIdMeta && existingOverlay.dataset.videoId !== videoIdMeta.content) {
            existingOverlay.remove();
        }

        if (playerContainer.querySelector('.audio-only-overlay')) return;

        playerContainer.style.backgroundColor = 'black';
        const overlay = document.createElement('div');
        overlay.className = 'audio-only-overlay';

        if (videoIdMeta) {
            overlay.dataset.videoId = videoIdMeta.content;
        }

        Object.assign(overlay.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'black',
            zIndex: '10',
            cursor: 'pointer'
        });

        overlay.addEventListener('click', () => {
            const playButton = document.querySelector('.ytp-play-button');
            if (playButton) {
                playButton.click();
            }
        });

        if (settings && settings.youtubeDisplayMode === 'thumbnail') {
            const thumbnailUrl = document.querySelector('meta[property="og:image"]')?.content;
            if (thumbnailUrl) {
                const img = document.createElement('img');
                img.src = thumbnailUrl;
                Object.assign(img.style, { width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' });
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

    if (!youtubeAudioObserver) {
        youtubeAudioObserver = new MutationObserver(modifyPlayer);
        youtubeAudioObserver.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('yt-navigate-finish', modifyPlayer);
    }
    modifyPlayer();
}

// ================= YouTube 每行影片數調整 =================
const YT_GRID_STYLE_ID = 'custom-yt-grid-style';

function updateYoutubeGrid(enabled, count) {
    if (!window.location.hostname.includes('youtube.com')) return;

    let style = document.getElementById(YT_GRID_STYLE_ID);
    if (!enabled) {
        if (style) style.remove();
        return;
    }

    if (!style) {
        style = document.createElement('style');
        style.id = YT_GRID_STYLE_ID;
        document.head.appendChild(style);
    }

    const perRow = parseInt(count, 10) || 5;
    style.textContent = `
        html,
        ytd-rich-grid-renderer,
        ytd-two-column-browse-results-renderer {
            --ytd-rich-grid-items-per-row: ${perRow} !important;
            --ytd-rich-grid-posts-per-row: ${perRow} !important;
            --ytd-rich-grid-slim-items-per-row: ${Math.max(perRow + 1, 6)} !important;
        }

        ytd-rich-grid-renderer > #contents > ytd-rich-grid-row,
        ytd-rich-grid-renderer > #contents > ytd-rich-grid-row > #contents {
            display: contents !important;
        }

        ytd-rich-item-renderer {
            width: calc(100% / var(--ytd-rich-grid-items-per-row) - var(--ytd-rich-grid-item-margin, 16px) - 0.01px) !important;
            max-width: calc(100% / var(--ytd-rich-grid-items-per-row) - var(--ytd-rich-grid-item-margin, 16px) - 0.01px) !important;
            margin-left: calc(var(--ytd-rich-grid-item-margin, 16px) / 2) !important;
            margin-right: calc(var(--ytd-rich-grid-item-margin, 16px) / 2) !important;
            margin-bottom: var(--ytd-rich-grid-row-margin, 24px) !important;
        }

        ytd-rich-shelf-renderer[is-shelf-rendering_] {
            --ytd-rich-grid-items-per-row: ${perRow} !important;
        }
    `;
}

// ================= YouTube 直播觀看人數徽章 =================
const YT_LIVE_STYLE_ID = 'custom-yt-live-viewers-style';
let liveViewersObserver = null;
let isLiveViewersEnabled = false;

function ensureLiveViewersStyle() {
    if (!document.getElementById(YT_LIVE_STYLE_ID)) {
        const style = document.createElement('style');
        style.id = YT_LIVE_STYLE_ID;
        style.textContent = `
            /* 讓縮圖右下角的 badge 容器橫向排列 */
            yt-thumbnail-overlay-badge-view-model,
            .yt-thumbnail-overlay-badge-view-model-wiz--bottom-end,
            ytd-thumbnail #overlays {
                display: flex !important;
                flex-direction: row !important;
                align-items: center !important;
                justify-content: flex-end !important;
            }

            .custom-yt-live-viewers-badge {
                display: inline-flex !important;
                align-items: center !important;
                background-color: rgba(0, 0, 0, 0.75) !important;
                color: #ffffff !important;
                font-size: 11px !important;
                font-weight: 500 !important;
                height: 18px !important;
                line-height: 18px !important;
                padding: 0 5px !important;
                border-radius: 4px !important;
                margin-right: 4px !important;
                white-space: nowrap !important;
                pointer-events: none !important;
                z-index: 10 !important;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4) !important;
                backdrop-filter: blur(2px) !important;
                max-width: 140px !important;
                overflow: hidden !important;
                text-overflow: ellipsis !important;
                vertical-align: middle !important;
            }
        `;
        document.head.appendChild(style);
    }
}

function extractLiveViewerText(card) {
    if (!card) return null;

    // 1. 優先在元數據相關元素中尋找
    const candidateElements = card.querySelectorAll(`
        #metadata-line span,
        .yt-lockup-view-model-wiz__metadata span,
        yt-content-metadata-view-model span,
        span.inline-metadata-item,
        span.yt-core-attributed-string,
        .ytd-video-meta-block span
    `);

    for (const el of candidateElements) {
        const text = el.textContent.trim();
        if (!text) continue;
        if (
            text.includes('正在觀看') ||
            text.includes('人在觀看') ||
            text.includes('人が視聴中') ||
            /\bwatching\b/i.test(text) ||
            text.includes('시청 중') ||
            text.includes('viendo') ||
            text.includes('spectateurs')
        ) {
            return text;
        }
    }

    // 2. 備用：卡片內葉子文字節點
    const allNodes = card.querySelectorAll('*');
    for (const node of allNodes) {
        if (node.children.length === 0) {
            const text = node.textContent.trim();
            if (
                text.includes('正在觀看') ||
                text.includes('人が視聴中') ||
                /^\s*[\d.,KkMm萬万]+\s*watching/i.test(text) ||
                text.includes('시청 중')
            ) {
                return text;
            }
        }
    }

    return null;
}

function processLiveBadges() {
    if (!isLiveViewersEnabled || !window.location.hostname.includes('youtube.com')) return;

    ensureLiveViewersStyle();

    // 尋找所有直播 badge（涵蓋 Polymer 與 Wiz 組件）
    const liveBadges = document.querySelectorAll(`
        badge-shape.badge-shape-wiz--thumbnail-live,
        .badge-shape-wiz--thumbnail-live,
        ytd-thumbnail-overlay-time-status-renderer[overlay-style="LIVE"],
        ytd-badge-supported-renderer [aria-label="LIVE"],
        yt-badge-shape[aria-label="LIVE"]
    `);

    liveBadges.forEach(badge => {
        // 找到所屬卡片容器
        const card = badge.closest('ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model') 
                  || badge.closest('ytd-thumbnail')?.closest('div, ytd-rich-grid-media')
                  || badge.closest('ytd-thumbnail')?.parentElement;
        if (!card) return;

        const viewerCountText = extractLiveViewerText(card);
        if (!viewerCountText) return;

        // 決定插入位置（直播 badge 的左側）
        let targetInsertBefore = badge;
        const badgeViewModel = badge.closest('yt-thumbnail-badge-view-model');
        if (badgeViewModel && badgeViewModel.parentElement) {
            targetInsertBefore = badgeViewModel;
        }

        const parent = targetInsertBefore.parentElement;
        if (!parent) return;

        let existingBadge = parent.querySelector('.custom-yt-live-viewers-badge');
        if (existingBadge) {
            if (existingBadge.textContent !== viewerCountText) {
                existingBadge.textContent = viewerCountText;
                existingBadge.setAttribute('title', viewerCountText);
            }
            return;
        }

        const viewerBadge = document.createElement('div');
        viewerBadge.className = 'custom-yt-live-viewers-badge';
        viewerBadge.textContent = viewerCountText;
        viewerBadge.setAttribute('title', viewerCountText);

        parent.insertBefore(viewerBadge, targetInsertBefore);
    });
}

function updateLiveViewersFeature(enabled) {
    if (!window.location.hostname.includes('youtube.com')) return;
    isLiveViewersEnabled = enabled;

    if (!enabled) {
        if (liveViewersObserver) {
            liveViewersObserver.disconnect();
            liveViewersObserver = null;
        }
        document.querySelectorAll('.custom-yt-live-viewers-badge').forEach(el => el.remove());
        const style = document.getElementById(YT_LIVE_STYLE_ID);
        if (style) style.remove();
        return;
    }

    processLiveBadges();

    if (!liveViewersObserver) {
        let timer = null;
        liveViewersObserver = new MutationObserver(() => {
            if (timer) return;
            timer = setTimeout(() => {
                timer = null;
                processLiveBadges();
            }, 250);
        });
        liveViewersObserver.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('yt-navigate-finish', processLiveBadges);
    }
}

// ================= 設定套用與主進入點 =================
function applySettings(settings) {
    if (!settings) return;

    if (settings.fxtwitter) {
        runFxTwitterLinkReplacer();
    }
    if (settings.youtubeAudioOnly) {
        runYoutubeAudioOnlyMode(settings);
    }

    // YouTube 每行影片數
    updateYoutubeGrid(settings.youtubeCustomGrid, settings.youtubeVideosPerRow);

    // YouTube 直播觀看人數
    updateLiveViewersFeature(settings.youtubeShowLiveViewers);
}

function main() {
    browser.storage.local.get('featureSettings').then((result) => {
        const settings = result.featureSettings || {};
        applySettings(settings);
    });

    // 監聽來自 popup 的設定變動，達成即時反應不用刷新
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.featureSettings) {
            applySettings(changes.featureSettings.newValue);
        }
    });
}

main();
