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
    async function sendMessage(action, payload = {}) {
        if (!chrome.runtime?.sendMessage) {
            return;
        }

        try {
            await chrome.runtime.sendMessage({ action, ...payload });
        } catch (error) {
            const message = chrome.runtime?.lastError?.message || error?.message;
            if (!message?.includes('Receiving end does not exist')) {
                console.warn(`发送 ${action} 消息失败:`, message || error);
            }
        }
    }

    async function openSidePanel() {
        if (!chrome.sidePanel) {
            return;
        }

        try {
            await chrome.sidePanel.setOptions({
                enabled: true,
                path: 'sidebar.html'
            });
            await chrome.sidePanel.open();
        } catch (error) {
            console.error('打开侧边栏失败:', error);
            throw error;
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
            console.error('操作失败:', error);
            alert('输入成功，重新点击插件以打开文档');
        }
    });

    // 添加回车键监听，按回车时自动点击打开按钮
    docLinkInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            openDocButton.click();
        }
    });
}); 