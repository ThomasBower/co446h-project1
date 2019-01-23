chrome.runtime.sendMessage({ type: 'getResults' }, results => results.forEach(outputResults));

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
    document.getElementById("checkResults").appendChild(htmlToElement(
        `<li class="${results.status}">
            <img src="img/checkmark.svg" class="icon checkmark" alt="Checkmark" />
            <img src="img/cross.svg" class="icon cross" alt="Cross" />
            <img src="img/warn.svg" class="icon exclamation" alt="Warn" />
            ${results.rule.name}
            <form action="${results.link}">
                <input type="submit" value="More" />
            </form>
        </li>`
    ));
}
