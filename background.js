let listenerAdded = false;

async function hashFileContent(content) {
    const msgBuffer = new TextEncoder().encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

function downloadFile(content, fileName, contentType) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
    }, () => {
        chrome.tabs.sendMessage(tab.id, { action: "extractMessages" }, (response) => {
        });
    });

    if (!listenerAdded) {
        chrome.runtime.onMessage.addListener(async (request) => {
            if (request.action === "messagesExtracted") {
                let messages = request.messages;

                // Store messages in a file
                const messagesContent = JSON.stringify(messages, null, 2);
                const fileName = 'messages.json';
                downloadFile(messagesContent, fileName, 'application/json');

                // Hash the file content
                let hash = await hashFileContent(messagesContent);
                console.log('File hash calculated:', hash);

                chrome.storage.local.set({ chatHash: hash, messages: messages }, () => {
                });
            }
        });
        listenerAdded = true;
    }
});
