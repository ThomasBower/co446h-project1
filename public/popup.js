const MAX_RATING = 10;

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    let currTab = tabs[0];

    if (checkInternal(currTab.url)) {
        return document.getElementById("checkResults").appendChild(
            htmlToElement(`<p class="cant-run">Web Audit cannot run on this page.</p>`));
    }

    chrome.runtime.sendMessage({ type: 'getResults', tabId: currTab.id }, results => {
        return results.forEach(outputResults);
    });
});

function htmlToElement(html) {
    var template = document.createElement('template');
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;
    return template.content.firstChild;
}

// results is an object in the format:
// { id: string,
//   ruleName: string,
//   decription: string,
//   default: boolean,
//   checkResults: {
//       severity: number
//       remedy: string,
//       link: url
//   }
//                    ${results.rule.name} (<span class="rating">${Math.max(0, MAX_RATING - Math.round(results.severity))}/${MAX_RATING}</span>)
function outputResults(results) {
    document.getElementById("checkResults").appendChild(htmlToElement(
        `<li class="${results.status}">
            <details>
                <summary>
                    <img src="img/checkmark.svg" class="icon checkmark" alt="Checkmark" />
                    <img src="img/cross.svg" class="icon cross" alt="Cross" />
                    <img src="img/warn.svg" class="icon exclamation" alt="Warn" />
                    ${results.rule.name} (<span class="rating">${results.severity}</span>)
                </summary>
                ${!results.remedy ? '<p>No errors to report.</p>' : `<p>${results.remedy}</p>`}
                ${!results.rule.link ? '' : `<a class="button" href="${results.rule.link}" target="_blank" rel="noreferrer">Learn More</a>`}
            </details>
        </li>`
    ));
}

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('options-link').addEventListener('click', function() {
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open(chrome.runtime.getURL('options.html'));
        }
    });
});

function checkInternal(urlString) {
    const protocol = (new URL(urlString)).protocol.slice(0, -1);
    return protocol === 'chrome' || protocol === 'chrome-extension';
}
