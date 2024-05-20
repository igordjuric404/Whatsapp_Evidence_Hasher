(async function () {
  if (typeof window.extractionInProgress === "undefined") {
    window.extractionInProgress = false;
  }

  function extractMessages() {
    if (window.extractionInProgress) {
      console.log("Extraction already in progress, skipping...");
      return;
    }

    window.extractionInProgress = true;
    console.log("Extraction started");

    let messages = [];
    let messageElements = document.querySelectorAll(
      "div.message-in, div.message-out"
    );
    let chatNameElement = document.querySelector("div._amif span");
    let chatName = chatNameElement ? chatNameElement.innerText : "Unknown";

    console.log("Initial message elements found:", messageElements.length);

    function loadAllMessages() {
      return new Promise((resolve) => {
        let scrollableDiv = document.querySelector("div._ajyl");
        if (!scrollableDiv) {
          console.error("Scrollable div not found");
          resolve();
          return;
        }

        let previousHeight = 0;
        let newHeight = scrollableDiv.scrollHeight;

        let interval = setInterval(() => {
          console.log("Scrolling to load more messages");
          scrollableDiv.scrollTop = 0;
          previousHeight = newHeight;
          newHeight = scrollableDiv.scrollHeight;

          if (newHeight === previousHeight) {
            clearInterval(interval);
            resolve();
          }
        }, 1000);
      });
    }

    loadAllMessages()
      .then(async () => {
        messageElements = document.querySelectorAll(
          "div.message-in, div.message-out"
        );
        console.log(
          "Total message elements found after scrolling:",
          messageElements.length
        );

        messageElements.forEach((element) => {
          let textElement = element.querySelector("span.selectable-text");
          let text = textElement ? textElement.innerText : "";

          let prePlainTextElement = element.querySelector("div.copyable-text");
          let prePlainText = prePlainTextElement
            ? prePlainTextElement.getAttribute("data-pre-plain-text")
            : "";

          let sender = "Unknown";
          let timestamp = "Unknown";

          if (prePlainText) {
            let matches = prePlainText.match(/\[(.*?)\] (.*?): /);
            if (matches) {
              timestamp = matches[1];
              sender = matches[2];
            }
          }

          if (text) {
            messages.push({ text, sender, timestamp });
          }
        });

        const messagesContent = JSON.stringify(messages, null, 2);
        const hash = await hashFileContent(messagesContent);

        // Send hash and messages to backend
        fetch("http://localhost/evidence/store_hash.php", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ hash: hash, messages: messages }),
        })
          .then((response) => response.json())
          .then((data) => {
            console.log("Hash and messages sent to backend:", data);
          })
          .catch((error) => {
            console.error("Error sending to backend:", error);
          });

        chrome.runtime.sendMessage({
          action: "messagesExtracted",
          messages: messages,
          chatName: chatName,
        });
        window.extractionInProgress = false;
        console.log("Extraction completed");
      })
      .catch((error) => {
        console.error("Error during extraction:", error);
        window.extractionInProgress = false;
      });
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Message received:", request.action);
    if (request.action === "extractMessages") {
      extractMessages();
      sendResponse({ status: "extracting" });
    }
  });

  async function hashFileContent(content) {
    const msgBuffer = new TextEncoder().encode(content);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hashHex;
  }
})();
