const PAGE_CONTEXT = 'PAGE_CONTEXT';
const EXT_CONTEXT = 'EXT_CONTEXT';

const BuiltInRules = [{
    id: 'usesSSL',
    name: 'Uses SSL',
    description: '',
    context: PAGE_CONTEXT,
    checkFunctionBody: `
        return {
            severity: location.protocol === 'https:' ? 0 : 3
        };
    `
}, {
    name: 'No Mixed Active Content',
    description: '',
    context: PAGE_CONTEXT,
    checkFunctionBody: `
        const PASS_RESULT = { severity: 0 };
        if (location.protocol !== 'https:') return PASS_RESULT;
        let tags = document.querySelectorAll('script[src], form[action],'
            + 'iframe[src], embed[src], source[src], param[value], a[href]');
        for (let tag of tags) {
            let source;
            switch (tag.tagName) {
                case 'script':
                case 'iframe':
                case 'embed':
                case 'source':
                source = tag.getAttribute('src');
                break;
                case 'form':
                source = tag.getAttribute('action');
                break;
                case 'param':
                source = tag.getAttribute('value');
                break;
                case 'a':
                source = tag.getAttribute('href');
            }
            if (!source) {
                continue;
            }
            if (source.split('/')[0] === 'http:') {
                return {
                    severity: 6
                }
            }
        }
        return PASS_RESULT;
    `
}, {
    id: 'noMixedPassiveContent',
    name: 'No Mixed Passive Content',
    description: '',
    context: PAGE_CONTEXT,
    checkFunctionBody: `
        const PASS_RESULT = { severity: 0 };
        if (location.protocol !== 'https:') return PASS_RESULT;
        let tags = document.querySelectorAll('img[src], object[data], audio[src],' + 'video[src]');
        for (let tag of tags) {
            let source = tag.tagName !== 'object' ?
            tag.getAttribute('src') : tag.getAttribute('data');
            if (source.split('/')[0] === 'http:') {
                return {
                    severity: 1
                };
            }
        }
        return PASS_RESULT;
    `
}];

let currentResults = [];

function runChecks() {
    return getUserRules()
    .then(userRules => [...BuiltInRules, ...userRules])
    .then(rules => Promise.all(rules.map(rule => {
        const checkFunctionString = `() => { ${rule.checkFunctionBody } }`;
        let result = {};
        if (rule.context === PAGE_CONTEXT) {
            result = runPageContextCheck(checkFunctionString);
        }
        if (rule.context === EXT_CONTEXT) {
            result = eval(checkFunctionString)();
        }
        return Promise.all([rule, result]);
    })))
    .then(results => results.map(([rule, result]) => new CheckResult(rule, result)))
    .catch(err => console.error(err));
}

function getUserRules() {
    return new Promise((resolve, reject) => chrome.storage.local.get(['rules'], ({ rules }) => resolve(rules)));
}

function updateIconNumber(num) {
    chrome.browserAction.setBadgeText({text: String(num)});
    if (num <= 0) {
        chrome.browserAction.setBadgeBackgroundColor({ color: [56, 239, 125, 255] });
    } else {
        chrome.browserAction.setBadgeBackgroundColor({ color: [246, 79, 89, 255] });
    }
    // TODO: Add support for different severity (e.g. yellow for warnings only)
}

function runPageContextCheck(checkFunctionString) {
    return new Promise((resolve, reject) => sendToContentScript({ type: 'runCheck', checkFunctionString }, resolve));
}

function sendToContentScript(message, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, ([currTab]) => {
        chrome.tabs.sendMessage(currTab.id, message, callback);
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
        if(this.severity > ERROR_SEVERITY_BOUND) return ERROR_STATUS;
        if(this.severity > WARN_SEVERITY_BOUND) return WARN_STATUS;
        return PASS_STATUS;
    }

    toJSON() {
        return { ...this, status: this.getStatus() };
    }
}

getUserRules().then(rules => { if (!rules) chrome.storage.local.set({ rules: [] }); });


chrome.tabs.onUpdated.addListener(function (tabId , info, tab) {
  if (info.status === 'complete') {
    const protocol = (new URL(tab.url)).protocol;
    if (!protocol || protocol === 'chrome:' || protocol === 'chrome-extension:') return;
    runChecks().then(results => {
        currentResults = results;
        updateIconNumber(results.filter(r => r.getStatus() !== PASS_STATUS).length);
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== 'getResults') return console.error("Unrecognised message: ", message);
    sendResponse(currentResults);
});
