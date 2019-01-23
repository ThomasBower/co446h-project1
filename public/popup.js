console.log("Top of popup.js");

chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {type: "getData"}, function(data) {
        Object.keys(data).forEach(function(key) {
            updateItem(key, data[key]) 
        });
    });
});

function updateItem(name, value) {
    document.getElementById(name).className = value ? 'pass' : 'fail';
}