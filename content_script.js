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
let liveViewersInterval = null;
let isLiveViewersEnabled = false;

function ensureLiveViewersStyle() {
    if (!document.getElementById(YT_LIVE_STYLE_ID)) {
        const style = document.createElement('style');
        style.id = YT_LIVE_STYLE_ID;
        style.textContent = `
            .custom-yt-live-row {
                display: inline-flex !important;
                flex-direction: row !important;
                align-items: center !important;
                justify-content: flex-end !important;
                pointer-events: none !important;
                z-index: 20 !important;
            }

            .custom-yt-live-viewers-badge {
                display: inline-flex !important;
                align-items: center !important;
                background-color: rgba(0, 0, 0, 0.78) !important;
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
                z-index: 20 !important;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5) !important;
                backdrop-filter: blur(2px) !important;
                letter-spacing: 0.3px !important;
                vertical-align: middle !important;
            }
        `;
        document.head.appendChild(style);
    }
}

function extractLiveViewerText(card) {
    if (!card) return null;

    const livePattern = /([\d.,\s]+[萬万KkMmBb]?\s*(?:人正在觀看|人在觀看|人が視聴中|watching|명\s*시청\s*중|personas\s*viendo|spectateurs))/i;

    // 優先在卡片中的文字節點搜尋
    const elements = card.querySelectorAll('#metadata-line span, .inline-metadata-item, yt-content-metadata-view-model span, .yt-core-attributed-string, span, div');
    for (const el of elements) {
        if (el.children.length > 2) continue;
        const txt = el.textContent.trim();
        if (!txt) continue;

        if (
            txt.includes('正在觀看') ||
            txt.includes('人在觀看') ||
            txt.includes('人が視聴中') ||
            /\bwatching\b/i.test(txt) ||
            txt.includes('시청 중') ||
            txt.includes('viendo') ||
            txt.includes('spectateurs')
        ) {
            const m = txt.match(livePattern);
            if (m) {
                return m[1].replace(/\s+/g, ' ').trim();
            }
            if (txt.length < 25) {
                return txt.replace(/\s+/g, ' ').trim();
            }
        }
    }

    // 備用：直接從整張卡片的文字提取
    const cardText = card.textContent;
    const match = cardText.match(livePattern);
    if (match) {
        return match[1].replace(/\s+/g, ' ').trim();
    }

    return null;
}

function processLiveBadges() {
    if (!isLiveViewersEnabled || !window.location.hostname.includes('youtube.com')) return;

    ensureLiveViewersStyle();

    // 抓取頁面上所有可能的影片卡片
    const cards = document.querySelectorAll(`
        ytd-rich-item-renderer,
        ytd-video-renderer,
        ytd-grid-video-renderer,
        ytd-compact-video-renderer,
        yt-lockup-view-model,
        ytd-rich-grid-media
    `);

    cards.forEach(card => {
        try {
            const viewerText = extractLiveViewerText(card);
            if (!viewerText) return;

            // 尋找卡片內的縮圖容器
            const thumbnail = card.querySelector(`
                ytd-thumbnail,
                a#thumbnail,
                yt-thumbnail-view-model,
                .yt-lockup-view-model-wiz__content-image,
                #thumbnail
            `);
            if (!thumbnail) return;

            // 尋找縮圖內的紅色直播標籤 (LIVE / 直播)
            let liveBadge = thumbnail.querySelector(`
                badge-shape.badge-shape-wiz--thumbnail-live,
                .badge-shape-wiz--thumbnail-live,
                ytd-thumbnail-overlay-time-status-renderer[overlay-style="LIVE"],
                [aria-label="LIVE"],
                [aria-label="直播"],
                [aria-label*="LIVE"],
                [aria-label*="直播"]
            `);

            if (!liveBadge) {
                const candidates = thumbnail.querySelectorAll('ytd-thumbnail-overlay-time-status-renderer, badge-shape, yt-badge-shape, div, span');
                for (const el of candidates) {
                    if (el.classList.contains('custom-yt-live-viewers-badge')) continue;
                    const txt = el.textContent.trim();
                    if ((txt === '直播' || txt === 'LIVE' || txt === 'ライブ' || txt.includes('直播') || txt.includes('LIVE')) && el.children.length <= 1) {
                        liveBadge = el.closest('ytd-thumbnail-overlay-time-status-renderer, yt-thumbnail-badge-view-model, badge-shape') || el;
                        break;
                    }
                }
            }

            // 檢查是否已存在人數徽章
            let existingBadge = thumbnail.querySelector('.custom-yt-live-viewers-badge');
            if (existingBadge) {
                if (existingBadge.textContent !== viewerText) {
                    existingBadge.textContent = viewerText;
                    existingBadge.setAttribute('title', viewerText);
                }
                return;
            }

            // 建立人數徽章
            const viewerBadge = document.createElement('div');
            viewerBadge.className = 'custom-yt-live-viewers-badge';
            viewerBadge.textContent = viewerText;
            viewerBadge.setAttribute('title', viewerText);

            if (liveBadge && liveBadge.parentNode) {
                let row = liveBadge.closest('.custom-yt-live-row');
                if (!row) {
                    row = document.createElement('div');
                    row.className = 'custom-yt-live-row';
                    liveBadge.parentNode.insertBefore(row, liveBadge);
                    row.appendChild(viewerBadge);
                    row.appendChild(liveBadge);
                } else {
                    row.insertBefore(viewerBadge, liveBadge);
                }
            } else {
                // 備用：若找不到 liveBadge 但卡片確定是直播，直接在縮圖右下角顯示
                const overlays = thumbnail.querySelector('#overlays') || thumbnail;
                viewerBadge.style.position = 'absolute';
                viewerBadge.style.bottom = '4px';
                viewerBadge.style.right = '4px';
                overlays.appendChild(viewerBadge);
            }
        } catch (err) {
            console.error('Error processing live badge:', err);
        }
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
        if (liveViewersInterval) {
            clearInterval(liveViewersInterval);
            liveViewersInterval = null;
        }
        document.querySelectorAll('.custom-yt-live-viewers-badge').forEach(el => el.remove());
        document.querySelectorAll('.custom-yt-live-row').forEach(row => {
            while (row.firstChild) {
                row.parentNode.insertBefore(row.firstChild, row);
            }
            row.remove();
        });
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
            }, 200);
        });
        liveViewersObserver.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('yt-navigate-finish', processLiveBadges);
        window.addEventListener('scroll', () => {
            if (timer) return;
            timer = setTimeout(() => {
                timer = null;
                processLiveBadges();
            }, 300);
        }, { passive: true });
    }

    if (!liveViewersInterval) {
        liveViewersInterval = setInterval(processLiveBadges, 1500);
    }
}

// ================= 設定套用與主進入點 =================
let currentActiveSettings = {};

function applySettings(settings) {
    if (!settings) return;
    currentActiveSettings = Object.assign({}, currentActiveSettings, settings);

    if (currentActiveSettings.fxtwitter) {
        runFxTwitterLinkReplacer();
    }
    if (currentActiveSettings.youtubeAudioOnly) {
        runYoutubeAudioOnlyMode(currentActiveSettings);
    }

    // YouTube 每行影片數
    updateYoutubeGrid(currentActiveSettings.youtubeCustomGrid, currentActiveSettings.youtubeVideosPerRow);

    // YouTube 直播觀看人數
    updateLiveViewersFeature(currentActiveSettings.youtubeShowLiveViewers);
}

function main() {
    browser.storage.local.get('featureSettings').then((result) => {
        const settings = result.featureSettings || {};
        applySettings(settings);
    });

    // 監聽來自 storage 的變動
    browser.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.featureSettings) {
            applySettings(changes.featureSettings.newValue);
        }
    });

    // 監聽來自 background / popup 的直接訊息通知，達成雙保險即時反應
    browser.runtime.onMessage.addListener((message) => {
        if (message.action === 'settingsUpdated' && message.settings) {
            applySettings(message.settings);
        } else if (message.action === 'settingDirectUpdate') {
            const update = {};
            update[message.key] = message.value;
            applySettings(update);
        }
    });
}

main();
