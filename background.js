chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'documentOpened') {
        // 文档打开后，将popup切换为reload.html
        chrome.action.setPopup({ popup: 'reload.html' });
    }
}); 