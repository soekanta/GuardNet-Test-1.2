// GuardNet - Sandbox Script for TensorFlow.js
// This runs in a sandboxed iframe with relaxed CSP
// UPDATED: Uses proper StandardScaler normalization from training

let model = null;
let scalerParams = null;

// Load the model
async function loadModel() {
    if (!model) {
        console.log('[Sandbox] Loading model...');
        try {
            model = await tf.loadLayersModel('./models/model.json');
            console.log('[Sandbox] Model loaded successfully');
        } catch (e) {
            console.error('[Sandbox] Failed to load model:', e);
            throw e;
        }
    }
    return model;
}

// Load scaler parameters
async function loadScalerParams() {
    if (!scalerParams) {
        console.log('[Sandbox] Loading scaler parameters...');
        try {
            const response = await fetch('./models/scaler_params.json');
            scalerParams = await response.json();
            console.log('[Sandbox] Scaler parameters loaded');
        } catch (e) {
            console.error('[Sandbox] Failed to load scaler params:', e);
            // Fallback: use no normalization (model might not work well)
            scalerParams = null;
        }
    }
    return scalerParams;
}

// Helper functions for features
function countChar(str, char) {
    return (str.split(char).length - 1);
}

function calculateEntropy(str) {
    if (!str) return 0;
    const len = str.length;
    const frequencies = {};
    for (let i = 0; i < len; i++) {
        const char = str[i];
        frequencies[char] = (frequencies[char] || 0) + 1;
    }
    let entropy = 0;
    for (const char in frequencies) {
        const p = frequencies[char] / len;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

/**
 * Extracts 50 numerical features from the URL and Page Content.
 * @param {string} urlStr - The URL to analyze.
 * @param {string} content - The HTML content of the page.
 * @returns {number[]} - Array of 50 numerical features.
 */
function extractFeatures(urlStr, content) {
    let urlObj;
    try {
        urlObj = new URL(urlStr);
    } catch (e) {
        console.error('Invalid URL:', urlStr);
        return new Array(50).fill(0);
    }

    // Handle empty content gracefully
    // When content is not available (CORS), use SUSPICIOUS defaults to not bias toward safe
    const hasContent = content && content.length > 100;

    const parser = new DOMParser();
    const doc = parser.parseFromString(content || '<html><head><title></title></head><body></body></html>', 'text/html');

    const features = [];

    // ========== URL-BASED FEATURES (1-22) ==========

    // 1. URLLength
    const urlLength = urlStr.length;
    features.push(urlLength);

    // 2. DomainLength
    const domainLength = urlObj.hostname.length;
    features.push(domainLength);

    // 3. IsDomainIP
    const isIP = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(urlObj.hostname) ? 1 : 0;
    features.push(isIP);

    // 4. URLSimilarityIndex
    const urlSimilarity = (urlLength < 50 && domainLength < 20) ? 80 : 50;
    features.push(urlSimilarity);

    // 5. CharContinuationRate
    let maxSeq = 0, currSeq = 1;
    for (let i = 1; i < urlStr.length; i++) {
        if (urlStr[i] === urlStr[i - 1]) currSeq++;
        else { maxSeq = Math.max(maxSeq, currSeq); currSeq = 1; }
    }
    const charContinuationRate = urlLength > 0 ? maxSeq / urlLength : 0;
    features.push(charContinuationRate);

    // 6. TLDLegitimateProb
    const tld = urlObj.hostname.split('.').pop();
    const commonTLDs = ['com', 'org', 'net', 'edu', 'gov', 'io', 'co', 'id'];
    const tldProb = commonTLDs.includes(tld) ? 0.9 : 0.3;
    features.push(tldProb);

    // 7. URLCharProb
    const urlEntropy = calculateEntropy(urlStr);
    const urlCharProb = 1.0 / (urlEntropy + 1);
    features.push(urlCharProb);

    // 8. TLDLength
    features.push(tld.length);

    // 9. NoOfSubDomain
    const parts = urlObj.hostname.split('.');
    const numSubdomains = parts.length - 2 > 0 ? parts.length - 2 : 0;
    features.push(numSubdomains);

    // 10. HasObfuscation
    const hasObfuscation = /%[0-9A-Fa-f]{2}/.test(urlStr) ? 1 : 0;
    features.push(hasObfuscation);

    // 11. NoOfObfuscatedChar
    const numObfuscated = (urlStr.match(/%[0-9A-Fa-f]{2}/g) || []).length;
    features.push(numObfuscated);

    // 12. ObfuscationRatio
    const obfuscationRatio = urlLength > 0 ? numObfuscated / urlLength : 0;
    features.push(obfuscationRatio);

    // 13. NoOfLettersInURL
    const numLetters = (urlStr.match(/[a-zA-Z]/g) || []).length;
    features.push(numLetters);

    // 14. LetterRatioInURL
    const letterRatio = urlLength > 0 ? numLetters / urlLength : 0;
    features.push(letterRatio);

    // 15. NoOfDigitsInURL
    const numDigits = (urlStr.match(/\d/g) || []).length;
    features.push(numDigits);

    // 16. DigitRatioInURL
    const digitRatio = urlLength > 0 ? numDigits / urlLength : 0;
    features.push(digitRatio);

    // 17. NoOfEqualsInURL
    features.push(countChar(urlStr, '='));

    // 18. NoOfQMarkInURL
    features.push(countChar(urlStr, '?'));

    // 19. NoOfAmpersandInURL
    features.push(countChar(urlStr, '&'));

    // 20. NoOfOtherSpecialCharsInURL
    const numSpecialChars = (urlStr.match(/[^a-zA-Z0-9\s]/g) || []).length;
    features.push(numSpecialChars);

    // 21. SpecialCharRatioInURL
    const specialCharRatio = urlLength > 0 ? numSpecialChars / urlLength : 0;
    features.push(specialCharRatio);

    // 22. IsHTTPS
    const isHttps = urlObj.protocol === 'https:' ? 1 : 0;
    features.push(isHttps);

    // ========== CONTENT-BASED FEATURES (23-50) ==========

    // 23. LineOfCode
    const lines = content ? content.split('\n').length : 100;
    features.push(lines);

    // 24. LargestLineLength
    const largestLine = content ? Math.max(...content.split('\n').map(l => l.length), 0) : 500;
    features.push(largestLine);

    // 25. HasTitle (suspicious default: 0 - phishing sites often lack proper titles)
    const hasTitle = doc.title && doc.title.trim().length > 0 ? 1 : 0;
    features.push(hasTitle);

    // 26. DomainTitleMatchScore (suspicious default: 0 - no match)
    const title = (doc.title || '').toLowerCase();
    const domain = urlObj.hostname.toLowerCase().replace('www.', '');
    const domainWords = domain.split('.')[0];
    const titleMatchScore = (title.includes(domainWords) || domainWords.includes(title.split(' ')[0])) ? 100 : 0;
    features.push(titleMatchScore);

    // 27. URLTitleMatchScore
    features.push(title.includes(urlStr) ? 100 : 0);

    // 28. HasFavicon (suspicious default: 0 - phishing sites often lack favicons)
    const hasFavicon = doc.querySelector('link[rel*="icon"]') ? 1 : 0;
    features.push(hasFavicon);

    // 29. Robots
    const hasRobots = content && content.toLowerCase().includes('robots') ? 1 : 0;
    features.push(hasRobots);

    // 30. IsResponsive (suspicious default: 0)
    const isResponsive = (doc.querySelector('meta[name="viewport"]') || (content && content.includes('@media'))) ? 1 : 0;
    features.push(isResponsive);

    // 31. NoOfURLRedirect
    features.push(0);

    // 32. NoOfSelfRedirect
    features.push(0);

    // 33. HasDescription (suspicious default: 0 - phishing sites often lack meta descriptions)
    const hasDescription = doc.querySelector('meta[name="description"]') ? 1 : 0;
    features.push(hasDescription);

    // 34. NoOfPopup
    const numPopups = content ? (content.toLowerCase().match(/window\.open/g) || []).length : 0;
    features.push(numPopups);

    // 35. NoOfIFrame
    const numIframes = doc.querySelectorAll('iframe').length;
    features.push(numIframes);

    // 36. HasExternalFormSubmit
    let hasExternalForm = 0;
    if (hasContent) {
        const forms = Array.from(doc.querySelectorAll('form'));
        forms.forEach(f => {
            if (f.action && f.action.startsWith('http') && !f.action.includes(urlObj.hostname)) {
                hasExternalForm = 1;
            }
        });
    }
    features.push(hasExternalForm);

    // 37. HasSocialNet (suspicious default: 0)
    const hasSocialNet = content && /facebook|twitter|instagram|linkedin/.test(content.toLowerCase()) ? 1 : 0;
    features.push(hasSocialNet);

    // 38. HasSubmitButton (keep as is - submit buttons are neutral)
    const hasSubmitBtn = doc.querySelector('input[type="submit"], button[type="submit"]') ? 1 : 0;
    features.push(hasSubmitBtn);

    // 39. HasHiddenFields
    const hasHiddenFields = doc.querySelectorAll('input[type="hidden"]').length > 0 ? 1 : 0;
    features.push(hasHiddenFields);

    // 40. HasPasswordField
    const hasPasswordField = doc.querySelectorAll('input[type="password"]').length > 0 ? 1 : 0;
    features.push(hasPasswordField);

    // 41. Bank keyword
    const hasBankKeyword = content && /bank|banking/i.test(content) ? 1 : 0;
    features.push(hasBankKeyword);

    // 42. Pay keyword
    const hasPayKeyword = content && /pay|payment/i.test(content) ? 1 : 0;
    features.push(hasPayKeyword);

    // 43. Crypto keyword
    const hasCryptoKeyword = content && /crypto|bitcoin/i.test(content) ? 1 : 0;
    features.push(hasCryptoKeyword);

    // 44. HasCopyrightInfo (suspicious default: 0 - phishing sites often lack copyright)
    const hasCopyright = content && /copyright|©/i.test(content) ? 1 : 0;
    features.push(hasCopyright);

    // 45. NoOfImage (use actual count, default 0)
    const numImages = doc.querySelectorAll('img').length;
    features.push(numImages);

    // 46. NoOfCSS (use actual count, default 0)
    const numCSS = doc.querySelectorAll('link[rel="stylesheet"], style').length;
    features.push(numCSS);

    // 47. NoOfJS (use actual count, default 0)
    const numJS = doc.querySelectorAll('script').length;
    features.push(numJS);

    // 48. NoOfSelfRef (use actual count, default 0)
    let numSelfRef = 0;
    const selfRefLinks = Array.from(doc.querySelectorAll('a'));
    numSelfRef = selfRefLinks.filter(a => {
        const href = a.getAttribute('href') || '';
        return href.includes(urlObj.hostname) || href.startsWith('/') || href.startsWith('#');
    }).length;
    features.push(numSelfRef);

    // 49. NoOfEmptyRef
    let numEmptyRef = 0;
    if (hasContent) {
        const links = Array.from(doc.querySelectorAll('a'));
        numEmptyRef = links.filter(a => {
            const href = a.getAttribute('href') || '';
            return href === '' || href === '#' || href === 'javascript:void(0)';
        }).length;
    }
    features.push(numEmptyRef);

    // 50. NoOfExternalRef (use actual count, default 0)
    let numExtRef = 0;
    const extRefLinks = Array.from(doc.querySelectorAll('a'));
    numExtRef = extRefLinks.filter(a => {
        const href = a.getAttribute('href') || '';
        return href.startsWith('http') && !href.includes(urlObj.hostname);
    }).length;
    features.push(numExtRef);

    console.log('[Sandbox] Features extracted:', features.length);

    return features.slice(0, 50);
}

/**
 * Normalize features using StandardScaler parameters from training
 */
function normalizeFeatures(features, scaler) {
    if (!scaler || !scaler.mean || !scaler.std) {
        console.warn('[Sandbox] No scaler params, using raw features');
        return features;
    }

    return features.map((val, i) => {
        const mean = scaler.mean[i] || 0;
        const std = scaler.std[i] || 1;
        // StandardScaler formula: (x - mean) / std
        return (val - mean) / std;
    });
}

// Predict function
async function predict(url, content) {
    await loadModel();
    await loadScalerParams();

    console.log('[Sandbox] Analyzing:', url);
    const features = extractFeatures(url, content);
    console.log('[Sandbox] Raw Features:', features);

    // Apply StandardScaler normalization (CRITICAL for accurate predictions!)
    const normalizedFeatures = normalizeFeatures(features, scalerParams);
    console.log('[Sandbox] Normalized Features:', normalizedFeatures.slice(0, 5), '...');

    const inputTensor = tf.tensor2d([normalizedFeatures], [1, 50]);

    const prediction = model.predict(inputTensor);
    // Model (Label 1=Legit) predicts P(Legitimate), so we invert it to get P(Phishing)
    const legitScore = prediction.dataSync()[0];
    const score = 1.0 - legitScore;

    // Cleanup tensors
    inputTensor.dispose();
    prediction.dispose();

    console.log('[Sandbox] Prediction score:', score);
    return score;
}

// Listen for messages from parent (popup via iframe)
window.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'PREDICT') {
        try {
            const score = await predict(event.data.url, event.data.content);
            event.source.postMessage({ type: 'PREDICT_RESULT', success: true, score: score }, '*');
        } catch (error) {
            console.error('[Sandbox] Error:', error);
            event.source.postMessage({ type: 'PREDICT_RESULT', success: false, error: error.message }, '*');
        }
    }
});

// Signal ready
window.addEventListener('load', () => {
    console.log('[Sandbox] Ready');
    // Pre-load model and scaler
    Promise.all([loadModel(), loadScalerParams()])
        .catch(err => console.error('[Sandbox] Pre-load error:', err));
});
