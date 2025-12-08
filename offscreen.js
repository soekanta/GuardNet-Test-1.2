// GuardNet - Offscreen Document for TensorFlow.js
// This script runs in a separate context with relaxed CSP

let model = null;
const MODEL_PATH = chrome.runtime.getURL('models/model.json');

// Load the model
async function loadModel() {
    if (!model) {
        console.log('[Offscreen] Loading model from:', MODEL_PATH);
        model = await tf.loadLayersModel(MODEL_PATH);
        console.log('[Offscreen] Model loaded successfully');
    }
    return model;
}

/**
 * Extracts 50 numerical features from the URL.
 * @param {string} url - The URL to analyze.
 * @returns {number[]} - Array of 50 numerical features.
 */
function extractFeatures(url) {
    // TODO: Implement the actual feature extraction logic here.
    // This function must return an array of exactly 50 numbers.
    // Example features: URL length, dot count, slash count, etc.

    console.warn('[Offscreen] Using dummy features! Implement real extraction logic.');

    // Returning a dummy array of 50 zeros for now
    return new Array(50).fill(0);
}

// Predict function
async function predict(url) {
    await loadModel();

    const features = extractFeatures(url);
    const inputTensor = tf.tensor2d([features], [1, 50]);

    const prediction = model.predict(inputTensor);
    const score = prediction.dataSync()[0];

    // Cleanup tensors
    inputTensor.dispose();
    prediction.dispose();

    console.log('[Offscreen] Prediction score:', score);
    return score;
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PREDICT') {
        predict(message.url)
            .then(score => {
                sendResponse({ success: true, score: score });
            })
            .catch(error => {
                console.error('[Offscreen] Prediction error:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Keep the message channel open for async response
    }
});

// Pre-load model on start
loadModel().catch(err => console.error('[Offscreen] Pre-load error:', err));
