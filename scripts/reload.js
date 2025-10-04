document.addEventListener('DOMContentLoaded', () => {
    const reloadDocButton = document.getElementById('reloadDoc');
    
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

        const callSidePanel = async (methodName, argVariants = [[]]) => {
            const fn = chrome.sidePanel?.[methodName];
            if (typeof fn !== 'function') {
                throw new Error('当前浏览器版本暂不支持侧边栏 API 的完整功能。');
            }

            let lastError;

            const invoke = async (args, mode) => {
                try {
                    if (mode === 'promise') {
                        const result = fn.call(chrome.sidePanel, ...args);
                        if (result && typeof result.then === 'function') {
                            await result;
                        }
                        return true;
                    }

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
                    return true;
                } catch (error) {
                    lastError = error;
                    return false;
                }
            };

            for (const args of argVariants) {
                if (await invoke(args, 'promise')) {
                    return;
                }

                if (await invoke(args, 'callback')) {
                    return;
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

            await callSidePanel('setOptions', [[{
                path: 'sidebar.html'
            }]]);

            const openArgs = [
                [],
                [{}],
                context.tabId != null ? [{ tabId: context.tabId }] : null,
                context.windowId != null ? [{ windowId: context.windowId }] : null,
                [undefined]
            ].filter(Boolean);

            await callSidePanel('open', openArgs);
        } catch (error) {
            const message = getErrorMessage(error);
            console.error('打开侧边栏失败:', message);
            throw new Error(`${message || '无法打开侧边栏'}\n\n${SIDE_PANEL_HINT}`);
        }
    }

    reloadDocButton.addEventListener('click', async () => {
        try {
            const { docLink } = await chrome.storage.local.get({ docLink: '' });

            if (!docLink) {
                alert('请先通过插件输入有效的文档链接');
                return;
            }

            const updatedAt = Date.now();
            await chrome.storage.local.set({ docLink, updatedAt });

            await openSidePanel();

            await sendMessage('loadDoc', { docLink, updatedAt, source: 'reload-action' });

            await sendMessage('documentOpened');

            window.close();
        } catch (error) {
            const message = getErrorMessage(error);
            console.error('重新打开文档失败:', message);
            const shouldAppendHint = !message.includes('在侧边栏中显示') && !message.includes('Chrome 114');
            alert(shouldAppendHint ? `${message}\n\n${SIDE_PANEL_HINT}` : message);
        }
    });
}); 