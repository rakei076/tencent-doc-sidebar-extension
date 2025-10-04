document.addEventListener('DOMContentLoaded', () => {
    const docLinkInput = document.getElementById('docLink');
    const openDocButton = document.getElementById('openDoc');

    // 从浏览器存储中读取上次使用的文档链接
    chrome.storage.local.get(['docLink'], function(result) {
        if (result.docLink) {
            docLinkInput.value = result.docLink;
        }
    });

    // 检查文档链接是否有效的函数
    const SIDE_PANEL_HINT = [
        '1. 请在 chrome://extensions/ 中打开该扩展的“详情”，勾选“在侧边栏中显示”。',
        '2. 首次使用需要点击浏览器右上角的侧边栏按钮（对话框图标），在列表中选择“腾讯文档侧边栏”。',
        '3. 确保 Chrome 版本 ≥ 114，或在 chrome://flags/ 中启用 Side Panel API。'
    ].join('\n');

    function getErrorMessage(error) {
        if (!error) {
            return '未知错误';
        }

        if (typeof error === 'string') {
            return error;
        }

        const runtimeMessage = chrome.runtime?.lastError?.message;
        return runtimeMessage || error.message || String(error);
    }

    async function sendMessage(action, payload = {}) {
        if (!chrome.runtime?.sendMessage) {
            return;
        }

        try {
            await chrome.runtime.sendMessage({ action, ...payload });
        } catch (error) {
            const message = getErrorMessage(error);
            if (!message.includes('Receiving end does not exist')) {
                console.warn(`发送 ${action} 消息失败:`, message);
            }
        }
    }

    async function openSidePanel() {
        if (!chrome.sidePanel) {
            throw new Error('当前浏览器版本不支持侧边栏 API，需使用 Chrome 114 及以上版本。');
        }

        const callSidePanel = async (methodName, argVariants) => {
            const fn = chrome.sidePanel?.[methodName];
            if (typeof fn !== 'function') {
                throw new Error('当前浏览器版本暂不支持侧边栏 API 的完整功能。');
            }

            let lastError;

            for (const args of argVariants) {
                try {
                    const expectsCallback = fn.length > args.length;

                    if (expectsCallback) {
                        await new Promise((resolve, reject) => {
                            try {
                                fn.call(chrome.sidePanel, ...args, (...cbArgs) => {
                                    const runtimeError = chrome.runtime?.lastError;
                                    if (runtimeError) {
                                        reject(new Error(runtimeError.message));
                                    } else {
                                        resolve(cbArgs[0]);
                                    }
                                });
                            } catch (error) {
                                reject(error);
                            }
                        });
                        return;
                    }

                    const result = fn.call(chrome.sidePanel, ...args);
                    if (result && typeof result.then === 'function') {
                        await result;
                    }
                    return;
                } catch (error) {
                    lastError = error;
                }
            }

            throw lastError || new Error('未知错误');
        };

        const getActiveContext = async () => {
            if (!chrome.tabs?.query) {
                return {};
            }

            try {
                const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
                const activeTab = tabs?.[0];
                if (!activeTab) {
                    return {};
                }
                return {
                    tabId: activeTab.id,
                    windowId: activeTab.windowId
                };
            } catch (error) {
                console.warn('获取当前标签信息失败:', getErrorMessage(error));
                return {};
            }
        };

        try {
            const context = await getActiveContext();

            const setOptionsVariants = [];
            if (context.tabId != null) {
                setOptionsVariants.push([{ tabId: context.tabId, path: 'sidebar.html', enabled: true }]);
            }
            setOptionsVariants.push([{ path: 'sidebar.html', enabled: true }]);

            await callSidePanel('setOptions', setOptionsVariants);

            const openVariants = [];
            if (context.tabId != null) {
                openVariants.push([{ tabId: context.tabId }]);
            }
            if (context.windowId != null) {
                openVariants.push([{ windowId: context.windowId }]);
            }
            if (typeof chrome.windows?.WINDOW_ID_CURRENT === 'number') {
                openVariants.push([{ windowId: chrome.windows.WINDOW_ID_CURRENT }]);
            }

            await callSidePanel('open', openVariants);
        } catch (error) {
            const message = getErrorMessage(error);
            console.error('打开侧边栏失败:', message);
            throw new Error(`${message || '无法打开侧边栏'}\n\n${SIDE_PANEL_HINT}`);
        }
    }

    function isValidDocLink(url) {
        try {
            const urlObj = new URL(url);
            const validDomains = [
                'docs.qq.com',
                'doc.weixin.qq.com',
                'feishu.cn',
                'larksuite.com'
            ];
            return validDomains.some(domain => urlObj.hostname.includes(domain));
        } catch {
            return false;
        }
    }

    // 点击"在侧边栏打开"按钮时的处理
    openDocButton.addEventListener('click', async () => {
        const docLink = docLinkInput.value.trim();
        
        if (!docLink) {
            alert('请输入文档链接');
            return;
        }

        if (!isValidDocLink(docLink)) {
            alert('请输入有效的腾讯文档或飞书文档链接');
            return;
        }

        try {
            // 保存链接到浏览器存储中
            await chrome.storage.local.set({ docLink, updatedAt: Date.now() });

            // 主动通知侧边栏加载最新链接
            await sendMessage('loadDoc', { docLink });

            // 通知background.js切换popup
            await sendMessage('documentOpened');

            // 打开侧边栏供用户使用
            await openSidePanel();

            // 关闭弹出窗口
            window.close();
        } catch (error) {
            const message = getErrorMessage(error);
            console.error('操作失败:', message);
            const shouldAppendHint = !message.includes('在侧边栏中显示') && !message.includes('Chrome 114');
            alert(shouldAppendHint ? `${message}\n\n${SIDE_PANEL_HINT}` : message);
        }
    });

    // 添加回车键监听，按回车时自动点击打开按钮
    docLinkInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            openDocButton.click();
        }
    });
}); 