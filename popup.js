let listenerAdded = false;

document.getElementById('extract').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
    });
    
    if (!listenerAdded) {
        chrome.runtime.onMessage.addListener(onMessageHandler);
        listenerAdded = true;
    }

    chrome.tabs.sendMessage(tab.id, { action: "extractMessages" }, (response) => {
        document.getElementById('status').innerText = 'Učitavanje poruka...';
    });
});

document.getElementById('verify').addEventListener('click', async () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.onchange = async (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target.result;
            const hash = await hashFileContent(content);

            fetch('http://localhost/evidence/verify_hash.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ hash: hash })
            }).then(response => response.json()).then(data => {
                if (data.status === 'success') {
                    document.getElementById('status').innerText = 'Validnost uspešna! Fajl nije izmenjen!';
                } else {
                    document.getElementById('status').innerText = 'Validnost neuspešna! Fajl je izmenjen!';
                }
            }).catch((error) => {
                console.error('Error verifying hash:', error);
                document.getElementById('status').innerText = 'Error verifying hash.';
            });
        };
        reader.readAsText(file);
    };
    fileInput.click();
});

async function onMessageHandler(request) {
    if (request.action === "messagesExtracted") {
        let messages = request.messages;
        const messagesContent = JSON.stringify(messages, null, 2);
        const fileName = `chat_${request.chatName || 'chat'}.json`;
        downloadFile(messagesContent, fileName, 'application/json');

        // Send hash and messages to backend
        const hash = await hashFileContent(messagesContent);
        fetch('http://localhost/evidence/store_hash.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ hash: hash, messages: messages })
        }).then(response => response.json()).then(data => {
            console.log('Hash and messages sent to backend:', data);
        }).catch((error) => {
            console.error('Error sending to backend:', error);
        });
    }
}

function downloadFile(content, fileName, contentType) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

async function hashFileContent(content) {
    const msgBuffer = new TextEncoder().encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}
