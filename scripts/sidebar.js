document.addEventListener('DOMContentLoaded', () => {
    const docFrame = document.getElementById('docFrame');
    const reloadButton = document.getElementById('reloadDoc');
    
    // 创建加载提示的div
    const loadingDiv = document.createElement('div');
    loadingDiv.innerHTML = '正在加载文档...';
    loadingDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        z-index: 1000;
    `;
    document.body.appendChild(loadingDiv);

    // 从浏览器存储中获取文档链接并加载
    chrome.storage.local.get(['docLink'], function(result) {
        if (result.docLink) {
            docFrame.src = result.docLink;
            
            docFrame.onload = () => {
                loadingDiv.style.display = 'none';
            };

            docFrame.onerror = () => {
                loadingDiv.innerHTML = '加载文档失败，请检查链接是否正确';
            };
        } else {
            loadingDiv.innerHTML = '请先在插件中输入文档链接';
        }
    });

    // 添加重新输入文档按钮点击事件
    reloadButton.addEventListener('click', async () => {
        try {
            // 立即显示加载提示
            loadingDiv.style.display = 'block';
            loadingDiv.innerHTML = '请先在插件中输入文档链接';
            
            // 立即清空iframe内容
            docFrame.srcdoc = '<html><body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;background:#f5f5f5;font-family:Arial;color:#666;">请输入新的文档链接...</body></html>';
            
            // 重置popup页面为初始状态
            await chrome.action.setPopup({ popup: 'popup.html' });
            
            // 清空当前文档链接
            await chrome.storage.local.remove('docLink');
            
            // 打开popup
            chrome.action.openPopup();
        } catch (error) {
            console.error('重置文档失败:', error);
        }
    });
});

// 保持现有的消息监听代码
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'reloadDoc') {
        const docFrame = document.getElementById('docFrame');
        if (docFrame && docFrame.src) {
            docFrame.src = docFrame.src;
        }
    }
}); 