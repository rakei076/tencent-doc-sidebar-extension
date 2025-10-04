document.addEventListener('DOMContentLoaded', () => {
    const reloadDocButton = document.getElementById('reloadDoc');
    
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

        await chrome.sidePanel.setOptions({
            enabled: true,
            path: 'sidebar.html'
        });
        await chrome.sidePanel.open();
    }

    reloadDocButton.addEventListener('click', async () => {
        try {
            const { docLink } = await chrome.storage.local.get({ docLink: '' });

            if (!docLink) {
                alert('请先通过插件输入有效的文档链接');
                return;
            }

            await sendMessage('loadDoc', { docLink });

            await openSidePanel();

            window.close();
        } catch (error) {
            console.error('重新打开文档失败:', error);
            alert('输入成功，重新点击插件以打开文档');
        }
    });
}); 