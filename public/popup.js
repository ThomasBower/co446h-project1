console.log("Top of popup.js");

// inclusive - the highest number which will e.g. pass
const PASS_CAP = 0;
const WARN_CAP = 3;

chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {type: "getData"}, function(data) {
        //outputResults(data); // TODO: DELETE BELOW
        Object.keys(data).forEach(function(key) {
            outputResults({
                ruleName: key,
                description: key + " and a bit longer description",
                checkResults: {
                    severity: data[key] ? 0 : 10,
                    remedy: "Don't be stupid",
                    link: "https://lmgtfy.com/?q=" + key
                },
            })
        });
    });
});


function htmlToElement(html) {
    var template = document.createElement('template');
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;
    return template.content.firstChild;
}

// results is an object in the format:
// { ruleName: string,
//   decription: string,
//   checkResults: {
//       severity: number
//       remedy: string,
//       link: url
//   }
function outputResults(results) {
    let severityIndicator;
    if(results.checkResults.severity <= PASS_CAP) {
        // pass
        severityIndicator = 'pass';
    } else if(results.checkResults.severity <= WARN_CAP) {
        // warn
        severityIndicator = 'warn';
    } else {
        // fail
        severityIndicator = 'fail';
    }

    document.getElementById("checkResults").appendChild(htmlToElement(
        `<li id="${results.name}" class="${severityIndicator}">
            <img src="img/checkmark.svg" class="icon checkmark" alt="Checkmark" />
            <img src="img/cross.svg" class="icon cross" alt="Cross" />
            <img src="img/warn.svg" class="icon exclamation" alt="Warn" />
            ${results.description}
            <form action="${results.checkResults.link}">
                <input type="submit" value="More" />
            </form>
        </li>`
    ));
}