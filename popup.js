// GuardNet - Popup Logic
// Communicates with sandboxed iframe for predictions

// UI Elements
const statusCard = document.getElementById('status-card');
const statusIcon = document.getElementById('status-icon');
const statusText = document.getElementById('status-text');
const confidenceText = document.getElementById('confidence-text');
const scanBtn = document.getElementById('scan-btn');
const btnText = document.querySelector('.btn-text');
const loader = document.querySelector('.loader');
const errorMsg = document.getElementById('error-msg');
const currentUrlSpan = document.getElementById('current-url');
const sandboxFrame = document.getElementById('sandbox-frame');

// Pending request callback
let pendingCallback = null;

// Helper to set UI state
function setUIState(state, message = '', confidence = 0) {
    statusCard.className = 'status-card'; // Reset classes

    if (state === 'loading') {
        scanBtn.disabled = true;
        loader.classList.remove('hidden');
        btnText.textContent = 'Scanning...';
        errorMsg.classList.add('hidden');
    } else {
        scanBtn.disabled = false;
        loader.classList.add('hidden');
        btnText.textContent = 'Scan Current Tab';
    }

    if (state === 'safe') {
        statusCard.classList.add('safe');
        statusIcon.textContent = '✅';
        statusText.textContent = 'Website Aman';
        confidenceText.textContent = `Confidence: ${(confidence * 100).toFixed(2)}%`;
    } else if (state === 'phishing') {
        statusCard.classList.add('phishing');
        statusIcon.textContent = '🚫';
        statusText.textContent = 'Phishing Terdeteksi!';
        confidenceText.textContent = `Confidence: ${(confidence * 100).toFixed(2)}%`;
    } else if (state === 'error') {
        errorMsg.textContent = message;
        errorMsg.classList.remove('hidden');
    }
}

// Listen for messages from sandbox
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PREDICT_RESULT') {
        if (pendingCallback) {
            pendingCallback(event.data);
            pendingCallback = null;
        }
    }
});

// Main scan function
// Main scan function
async function scanUrl(url, tabId) {
    setUIState('loading');
    currentUrlSpan.textContent = url;

    try {
        // 1. Fetch page content using scripting API
        let pageContent = '';
        try {
            const result = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => document.documentElement.outerHTML
            });
            if (result && result[0]) {
                pageContent = result[0].result;
            }
        } catch (err) {
            console.warn('Could not fetch page content (restricted page?), using empty content:', err);
        }

        // 2. Set up callback for result
        pendingCallback = (response) => {
            if (response.success) {
                const score = response.score;
                console.log(`Prediction Score: ${score}`);

                if (score > 0.5) {
                    setUIState('phishing', '', score);
                } else {
                    setUIState('safe', '', 1 - score);
                }
            } else {
                setUIState('error', response.error || 'Prediction failed');
            }
        };

        // 3. Send message to sandbox iframe with URL AND Content
        sandboxFrame.contentWindow.postMessage({
            type: 'PREDICT',
            url: url,
            content: pageContent
        }, '*');

        // Timeout after 10 seconds
        setTimeout(() => {
            if (pendingCallback) {
                pendingCallback = null;
                setUIState('error', 'Timeout: Model tidak merespons.');
            }
        }, 10000);

    } catch (error) {
        console.error('Scan error:', error);
        setUIState('error', error.message || 'Gagal memproses URL.');
    }
}

// Event Listener
scanBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs && tabs[0]) {
            const url = tabs[0].url;
            const tabId = tabs[0].id;
            scanUrl(url, tabId);
        } else {
            setUIState('error', 'Tidak dapat mengambil URL tab aktif.');
        }
    });
});
