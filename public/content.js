const PAGE_CONTEXT = 'PAGE_CONTEXT';
const EXT_CONTEXT = 'EXT_CONTEXT';

const Rules = [{
    id: 'usesSSL',
    ruleName: 'Uses SSL',
    description: '',
    context: PAGE_CONTEXT,
    checkFunction() {
        return usesSSL();
    }
}, {
    id: 'noMixedActiveContent',
    ruleName: 'No Mixed Active Content',
    description: '',
    context: PAGE_CONTEXT,
    checkFunction() {
        if (!usesSSL()) return true;
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
                return false;
            }
        }
        return true;
    }
}, {
    id: 'noMixedPassiveContent',
    ruleName: 'No Mixed Passive Content',
    description: '',
    context: PAGE_CONTEXT,
    checkFunction() {
        if (!usesSSL()) return true;
        let tags = document.querySelectorAll('img[src], object[data], audio[src],' + 'video[src]');
        for (let tag of tags) {
            let source = tag.tagName !== 'object' ?
            tag.getAttribute('src') : tag.getAttribute('data');
            if (source.split('/')[0] === 'http:') {
                return false;
            }
        }
        return true;
    }
}];

function usesSSL() {
    return location.protocol === 'https:';
}

console.log('[WebAudit] Loaded content script');

function generateResults() {
    return Rules.reduce((results, rule) => {
        results[rule.id] = rule.checkFunction();
        return results;
    }, {});
}

chrome.runtime.onMessage.addListener(
    function(message, sender, sendResponse) {
        switch(message.type) {
            case "getData":
                sendResponse(generateResults());
                break;
            default:
                console.error("Unrecognised message: ", message);
        }
    }
);

chrome.runtime.sendMessage({
    type: "updateNumbers",
    number: Object.values(generateResults()).reduce((a, b) => !b ? a+1 : a, 0)
});
