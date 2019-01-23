let numRules = 0;

// Saves options to chrome.storage
function saveOptions() {
    const rules = document.querySelectorAll('.rule');
    const parsedRules = [];

    for (let rule of rules) {
        parsedRules.push({
            name: rule.querySelector('.rule-name').value,
            context: rule.querySelector('.context').value,
            checkFunctionBody: rule.querySelector('.check-function').value,
            description: rule.querySelector('.description').value
        })
    }

    console.log('rules', parsedRules);

    chrome.storage.local.set({
        rules: parsedRules
    }, function () {
        // Update status to let user know options were saved.
        let status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(function () {
            status.textContent = '';
        }, 1500);
    });
}

function restoreOptions() {
    chrome.storage.local.get(['rules'], function (data) {
        for (let rule of data.rules) {
            addRule(rule);
        }
    });
}

//TODO(ThomasBower): Remove duplicate function from popup.js
function htmlToElement(html) {
    var template = document.createElement('template');
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;
    return template.content.firstChild;
}

function generateRule(rule, index) {
    if (!rule) {
        rule = {
            name: '',
            context: '',
            checkFunctionBody: '',
            description: ''
        };
    }
    const output = `
    <fieldset class="rule">
    <legend>Rule ${index}</legend>
    <label>
        Rule Name<abbr title="required">*</abbr>:
        <input type="text" class="rule-name" value="${rule.name}" />
    </label>
    <label>
        Context<abbr title="required">*</abbr>:
        <select class="context">
            <option value="PAGE_CONTEXT" ${rule.context === 'PAGE_CONTEXT' ? 'selected' : ''}>Page</option>
            <option value="EXT_CONTEXT" ${rule.context === 'EXT_CONTEXT' ? 'selected' : ''}>Extension</option>
        </select>
    </label>
    <label>
        Check Function<abbr title="required">*</abbr>:
        <br />
        <code class="top-margin">function checkFunction() {</code>
        <textarea class="check-function codeblock">${rule.checkFunctionBody}</textarea>
        <code>}</code>
    </label>
    <label>
        Description:
        <textarea class="description">${rule.description}</textarea>
    </label>
    </fieldset>
    `;
    return htmlToElement(output);
}

function addRule(rule) {
    document.getElementById('rules').appendChild(generateRule(rule, ++numRules));
}


document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('add-rule').addEventListener('click', addRule);
