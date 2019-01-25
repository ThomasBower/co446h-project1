let numRules = 0;

// Saves options to chrome.storage
function saveOptions() {
    const rules = document.querySelectorAll('.rule:not(.default)');
    const parsedRules = [];

    for (let rule of rules) {
        parsedRules.push({
            name: rule.querySelector('.rule-name').value,
            context: rule.querySelector('.context').value,
            checkFunctionBody: rule.querySelector('.check-function').value,
            description: rule.querySelector('.description').value
        })
    }

    chrome.storage.sync.set({
        rules: parsedRules
    }, function () {
        // Update status to let user know options were saved.
        let status = document.getElementById('status');
        status.className = 'show';
        setTimeout(function () {
            status.className = '';
        }, 2500);
    });
}

function restoreOptions() {
    numRules = 0;
    chrome.extension.getBackgroundPage().getRules().then(rules => {
        for (let rule of rules) {
            addRule(rule, rule.builtIn);
        }
        document.querySelectorAll('.delete').forEach((button) => {
            button.addEventListener('click', function(e) {
                button.parentElement.remove();
                e.preventDefault();
            });
        });
    });
}

//TODO(ThomasBower): Remove duplicate function from popup.js
function htmlToElement(html) {
    var template = document.createElement('template');
    html = html.trim(); // Never return a text node of whitespace as the result
    template.innerHTML = html;
    return template.content.firstChild;
}

function generateRule(rule, index, isDefault) {
    const output = `
    <fieldset class="rule ${isDefault ? 'default' : ''}">
    <legend>Rule ${index}</legend>
    <label>
        Rule Name<abbr title="required">*</abbr>:
        <input type="text" class="rule-name" value="${rule.name || ''}" ${isDefault ? 'disabled' : ''} />
    </label>
    <label>
        Context<abbr title="required">*</abbr>:
        <select class="context" ${isDefault ? 'disabled' : ''}>
            <option value="PAGE_CONTEXT" ${rule.context === 'PAGE_CONTEXT' ? 'selected' : ''}>Page</option>
            <option value="EXT_CONTEXT" ${rule.context === 'EXT_CONTEXT' ? 'selected' : ''}>Extension</option>
        </select>
    </label>
    <label>
        Check Function<abbr title="required">*</abbr>:
        <br />
        <code class="top-margin">function checkFunction() {</code>
        <textarea class="check-function codeblock" ${isDefault ? 'disabled' : ''}>${rule.checkFunctionBody || ''}</textarea>
        <code>}</code>
    </label>
    <label>
        Description:
        <textarea class="description" ${isDefault ? 'disabled' : ''}>${rule.description || ''}</textarea>
    </label>
    ${!isDefault ? `<a href="#" class="delete">Delete</a>` : ''}
    </fieldset>
    `;
    return htmlToElement(output);
}

function addRule(rule, isDefault = false) {
    let elem = document.getElementById('rules').appendChild(generateRule(rule, ++numRules, isDefault));
    if (!isDefault) {
        elem.querySelector('.delete').addEventListener('click', function(e) {
            elem.querySelector('.delete').parentElement.remove();
            e.preventDefault();
        });
    }
}

document.addEventListener('keydown', function(e) {
    if (e.keyCode == 'S'.charCodeAt(0) && (navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey)) {
        e.preventDefault();
        saveOptions();
    }
});

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('add-rule').addEventListener('click', addRule);
