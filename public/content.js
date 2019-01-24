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
