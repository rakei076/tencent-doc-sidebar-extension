document.addEventListener('DOMContentLoaded', () => {
    const docFrame = document.getElementById('docFrame');
    const reloadButton = document.getElementById('reloadDoc');
    const statusOverlay = document.createElement('div');
    const statusText = document.createElement('span');

    let currentDocLink = '';
    let forceOverlay = false;

    statusOverlay.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 255, 255, 0.95);
        padding: 20px 24px;
        border-radius: 12px;
        box-shadow: 0 12px 60px rgba(15, 23, 42, 0.18);
        z-index: 1000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #1f2937;
        min-width: 220px;
        text-align: center;
        display: none;
        line-height: 1.5;
        white-space: pre-line;
    `;
    statusText.textContent = '正在加载文档...';
    statusOverlay.appendChild(statusText);
    document.body.appendChild(statusOverlay);

    const placeholderTemplate = (message) => `
        <html>
            <head>
                <meta charset="utf-8" />
                <style>
                    body {
                        margin: 0;
                        height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #f5f5f5;
                        color: #4b5563;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                        font-size: 16px;
                        text-align: center;
                        padding: 32px;
                        box-sizing: border-box;
                    }
                    strong {
                        color: #2563eb;
                    }
                </style>
            </head>
            <body>${message}</body>
        </html>
    `;

    const showOverlay = (message, options = {}) => {
        const { persistent = false } = options;
        statusText.textContent = message;
        statusOverlay.style.display = 'block';
        forceOverlay = persistent;
    };

    const hideOverlay = () => {
        if (!forceOverlay) {
            statusOverlay.style.display = 'none';
        }
    };

    const resetOverlay = () => {
        forceOverlay = false;
        hideOverlay();
    };

    const showPlaceholder = (message) => {
        currentDocLink = '';
        forceOverlay = false;
        statusOverlay.style.display = 'none';
        docFrame.removeAttribute('src');
        docFrame.srcdoc = placeholderTemplate(message);
    };

    const EMBED_TIP_TEXT = '加载失败，可能原因：\n• 链接无效或权限不足\n• 文档未开启“网页预览/允许嵌入”\n• 浏览器拦截了第三方 Cookie';

    const loadDocument = async (docLink) => {
        if (!docLink) {
            showPlaceholder('请先在插件中输入文档链接');
            return;
        }

        if (docLink === currentDocLink && docFrame.src === docLink) {
            return;
        }

        currentDocLink = docLink;
        forceOverlay = false;
        showOverlay('正在加载文档...');

        try {
            docFrame.srcdoc = '';
            docFrame.src = docLink;
        } catch (error) {
            console.error('加载文档失败:', error);
            showOverlay(EMBED_TIP_TEXT, { persistent: true });
            const placeholderMessage = `加载失败，可能原因：<br>• 链接无效或权限不足<br>• 文档未开启“网页预览/允许嵌入”<br>• 浏览器拦截了第三方 Cookie<br><br>建议：在文档分享设置中开启网页预览/允许嵌入，或将上述域名加入 Cookie 允许列表。`;
            showPlaceholder(placeholderMessage);
        }
    };

    const refreshCurrentDocument = () => {
        if (!currentDocLink) {
            showPlaceholder('请先在插件中输入文档链接');
            return;
        }
        showOverlay('正在重新加载文档...');
        const previousSrc = docFrame.src;
        docFrame.src = 'about:blank';
        requestAnimationFrame(() => {
            docFrame.src = previousSrc;
        });
    };

    docFrame.addEventListener('load', () => {
        resetOverlay();
    });

    docFrame.addEventListener('error', () => {
        showOverlay('加载文档失败，请检查链接是否正确', { persistent: true });
    });

    chrome.storage.local.get({ docLink: '' }).then((result) => {
        loadDocument(result.docLink);
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.docLink) {
            loadDocument(changes.docLink.newValue);
        }
    });

    reloadButton.addEventListener('click', async () => {
        showOverlay('即将重置文档...', { persistent: true });
        try {
            await chrome.storage.local.remove(['docLink', 'updatedAt']);
            showPlaceholder('请输入新的文档链接...');

            if (chrome.action?.setPopup) {
                await chrome.action.setPopup({ popup: 'popup.html' });
            }

            if (chrome.action?.openPopup) {
                await chrome.action.openPopup();
            }
        } catch (error) {
            console.error('重置文档失败:', error);
            showOverlay('重置失败，请手动点击插件图标重试', { persistent: true });
        } finally {
            forceOverlay = false;
        }
    });

    chrome.runtime.onMessage.addListener((message) => {
        if (message?.action === 'loadDoc') {
            loadDocument(message.docLink);
        }

        if (message?.action === 'reloadDoc') {
            refreshCurrentDocument();
        }
    });
});