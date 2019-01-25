const SUITABLE_ENTROPY = 100;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== 'runCheck') return log("Unrecognised message: " + message, 'error');
    const checkFunction = eval(message.checkFunctionString);
    sendResponse(checkFunction());
});

log('Loaded content script');

function log(message, logType = 'log') {
    if (logType !== 'log' && logType !== 'error' && logType !== 'info' && logType !== 'warn') return;
    console[logType]('[WebAudit] ', message);
}

/**
 * Based on:
 * https://stackoverflow.com/questions/3620116/get-css-path-from-dom-element
 */
function getCSSPath(el) {
    if (!(el instanceof Element)) return;
    var path = [];
    while (el.nodeType === Node.ELEMENT_NODE) {
        var selector = el.nodeName.toLowerCase();
        if (el.id) {
            selector += '#' + el.id;
        } else {
            var sib = el, nth = 1;
            while (sib.nodeType === Node.ELEMENT_NODE && (sib = sib.previousSibling) && nth++);
            selector += ":nth-child("+nth+")";
        }
        path.unshift(selector);
        el = el.parentNode;
    }
    return path.join(" > ");
}