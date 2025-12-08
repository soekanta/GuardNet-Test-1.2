// GuardNet - Background Service Worker
// Handles communication between popup and offscreen document

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

let creatingOffscreen; // Lock to avoid concurrency issues

async function hasOffscreenDocument() {
    const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
    });
    return contexts.length > 0;
}

async function setupOffscreenDocument() {
    if (await hasOffscreenDocument()) {
        return;
    }

    if (creatingOffscreen) {
        await creatingOffscreen;
    } else {
        creatingOffscreen = chrome.offscreen.createDocument({
            url: OFFSCREEN_DOCUMENT_PATH,
            reasons: ['DOM_SCRAPING'], // Using DOM_SCRAPING as a valid reason for ML tasks
            justification: 'Running TensorFlow.js for phishing detection'
        });
        await creatingOffscreen;
        creatingOffscreen = null;
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCAN_URL') {
        (async () => {
            try {
                await setupOffscreenDocument();

                // Forward the request to offscreen document
                const response = await chrome.runtime.sendMessage({
                    type: 'PREDICT',
                    url: message.url
                });

                sendResponse(response);
            } catch (error) {
                console.error('[Background] Error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true; // Keep message channel open
    }
});

console.log('[Background] GuardNet service worker started');
