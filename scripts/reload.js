document.addEventListener('DOMContentLoaded', () => {
    const reloadDocButton = document.getElementById('reloadDoc');
    
    reloadDocButton.addEventListener('click', async () => {
        try {
            // 打开侧边栏
            if (chrome.sidePanel) {
                chrome.sidePanel.setOptions({
                    enabled: true,
                    path: 'sidebar.html'
                }).then(() => {
                    return chrome.sidePanel.open();
                }).catch(error => {
                    console.error('重新打开文档失败:', error);
                    alert('输入成功，重新点击插件以打开文档');
                });
            }
            
            window.close();
        } catch (error) {
            console.error('重新打开文档失败:', error);
            alert('输入成功，重新点击插件以打开文档');
        }
    });
}); 