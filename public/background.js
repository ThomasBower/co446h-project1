chrome.runtime.onMessage.addListener(
    function(message, sender) {
        console.log(message);
        switch(message.type) {
            case "updateNumbers":
                updateIconNumber(message.number);
                break;
            default:
                console.error("Unrecognised message: ", message);
        }
    }
);

function updateIconNumber(num) {
    chrome.browserAction.setBadgeText({text: String(num)});
    if (num <= 0) {
        chrome.browserAction.setBadgeBackgroundColor({ color: [56, 239, 125, 255] });
    } else {
        chrome.browserAction.setBadgeBackgroundColor({ color: [246, 79, 89, 255] });
    }
    // TODO: Add support for different severity (e.g. yellow for warnings only)
}