const UNDEFINED_RESULT = { severity: -1, remedy: 'Rule check function failed to return a result' };
const REQUEST_TIME_THRESHOLD = 50;
const FAIL_BADGE_COLOUR = [246, 79, 89, 255];
const WARN_BADGE_COLOUR = [255, 224, 0, 255];
const PASS_BADGE_COLOUR = [56, 239, 125, 255];
const LOAD_BADGE_COLOUR = [70, 136, 241, 255];
const tabs = {};

function getRules() {
    return new Promise(res => chrome.storage.sync.get(['rules', 'defaultRules'],
        ({ rules, defaultRules }) => res([...(defaultRules || []), ...(rules || [])])));
}

function runChecks() {
    return getRules()
        .then(rules => Promise.all(rules.map(rule => Promise.all([rule, runRule(rule)]))))
        .then(results => results.map(([rule, result]) => new CheckResult(rule, result || UNDEFINED_RESULT)))
        .catch(err => console.error(err));
}

function runRule(rule) {
    return getCurrentTab().then(currTab => {
        if (!currTab) return UNDEFINED_RESULT;
        if (rule.context === PAGE_CONTEXT) {
            const checkFunctionString = `() => { ${rule.checkFunctionBody } }`;
            return sendMessage(currTab.id, { type: 'runCheck', checkFunctionString });
        }
        if (rule.context === EXT_CONTEXT) {
            const checkFunctionString = `(requests) => { ${rule.checkFunctionBody } }`;
            return eval(checkFunctionString)(getTabInfo(currTab.id).requests);
        }
        return UNDEFINED_RESULT;
    });
}

const ERROR_SEVERITY_BOUND = 3;
const WARN_SEVERITY_BOUND = 0;
const ERROR_STATUS = 'fail';
const WARN_STATUS = 'warn';
const PASS_STATUS = 'pass';
class CheckResult {
    constructor(rule, result) {
        this.rule = rule;
        this.severity = result.severity;
        this.remedy = result.remedy;
        this.link = result.link;
    }

    getStatus() {
        if (this.severity === -1) return WARN_STATUS;
        if (this.severity > ERROR_SEVERITY_BOUND) return ERROR_STATUS;
        if (this.severity > WARN_SEVERITY_BOUND) return WARN_STATUS;
        return PASS_STATUS;
    }

    toJSON() {
        return { ...this, status: this.getStatus() };
    }
}

function updateIconBadge() {
    getCurrentTab().then((tab) => {
        if (!tab) return;
        const tabInfo = getTabInfo(tab.id);

        // Disable action if on an internal page, otherwise enable
        if (tabInfo.internalPage) return disableBadge();
        // Display loading indicator if page not yet loaded/no results
        if (!tabInfo.results) return showLoadingBadge();

        // Enumerate warnings & errors
        const warnings = tabInfo.results.filter(r => r.getStatus() === WARN_STATUS).length;
        const errors = tabInfo.results.filter(r => r.getStatus() === ERROR_STATUS).length;
        showResultBadge(warnings, errors);
    });
}

function disableBadge() {
    chrome.browserAction.disable();
    chrome.browserAction.setBadgeText({ text: '' });
}

function showLoadingBadge() {
    chrome.browserAction.setBadgeText({ text: '…' });
    chrome.browserAction.setBadgeBackgroundColor({ color: LOAD_BADGE_COLOUR });
}

function showResultBadge(warnCount, errorCount) {
    chrome.browserAction.enable();
    chrome.browserAction.setBadgeText({ text: String(warnCount + errorCount) });
    chrome.browserAction.setBadgeBackgroundColor({
        color: errorCount > 0 ? FAIL_BADGE_COLOUR
            : warnCount > 0 ? WARN_BADGE_COLOUR : PASS_BADGE_COLOUR
    });
}

// Record all web requests to their respective tabs
chrome.webRequest.onCompleted.addListener(requestDetails => {
    getTabInfo(requestDetails.tabId).requests.push(requestDetails);
}, { urls: ['*://*/*'] }, ['responseHeaders']);

// Run checks when a webpage is loaded
chrome.tabs.onUpdated.addListener(function (tabId, info, tab) {
    const tabInfo = getTabInfo(tabId);
    if (info.status === 'loading' && tabInfo.url !== tab.url) resetTabInfo(tabId, tab.url);

    tabInfo.internalPage = checkInternal(tab.url);
    updateIconBadge(tabId);

    if (info.status === 'complete' && !tabInfo.internalPage) {
        runChecks().then(results => {
            getTabInfo(tabId).results = results;
            updateIconBadge(tabId);
        });
    }
});

// Update tab dictionary on creation & destruction
chrome.tabs.onCreated.addListener(({ tabId }) => tabs[tabId] = { requests: [] });
chrome.tabs.onRemoved.addListener((tabId) => delete tabs[tabId]);

// Update extension icon badge
chrome.tabs.onActivated.addListener(updateIconBadge);

// Send data to popup when requested
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== 'getResults') return console.error("Unrecognised message: ", message);
    sendResponse(getTabInfo(message.tabId).results);
});


function getTabInfo(tabId) {
    if (!tabs[tabId]) resetTabInfo(tabId);
    return tabs[tabId];
}
function resetTabInfo(tabId, url) {
    const oldInfo = tabs[tabId] || { requests: [], noOldInfo: true };
    const resetTime = (new Date()).getTime();
    tabs[tabId] = { requests: oldInfo.requests.filter(r => (resetTime - r.timeStamp) < REQUEST_TIME_THRESHOLD), url };
}

function checkInternal(urlString) {
    const protocol = (new URL(urlString)).protocol.slice(0, -1);
    return protocol === 'chrome' || protocol === 'chrome-extension';
}

function getCurrentTab() {
    return new Promise(resolve => chrome.tabs.query({
        active: true,
        currentWindow: true
    }, ([currTab]) => resolve(currTab)));
}

function sendMessage(tabId, message) {
    return new Promise(res => chrome.tabs.sendMessage(tabId, message, res));
}
