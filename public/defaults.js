const PAGE_CONTEXT = 'PAGE_CONTEXT';
const EXT_CONTEXT = 'EXT_CONTEXT';

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.set({
        defaultRules: defaultRules.map(rule => ({
            ...rule, checkFunctionBody: getFunctionBody(rule.checkFunction)
        }))
    });
});

const defaultRules = [{
    name: 'Uses SSL',
    description: '',
    link: 'https://developer.mozilla.org/en-US/docs/Glossary/https',
    context: PAGE_CONTEXT,
    checkFunction() {
        if (location.protocol === 'https:') return { severity: 0 };
        return {
            severity: 3,
            remedy: `This site uses HTTP, meaning that data is transmitted unsecured across the network.
             Seek assistance from your web host to buy and set up a certificate.`
        };
    }
}, {
    name: 'No Mixed Active Content',
    description: '',
    context: PAGE_CONTEXT,
    checkFunction() {
        const PASS_RESULT = {severity: 0};
        if (location.protocol !== 'https:') return PASS_RESULT;
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
                return {
                    severity: 6
                }
            }
        }
        return PASS_RESULT;
    }
}, {
    name: 'No Mixed Passive Content',
    description: '',
    context: PAGE_CONTEXT,
    checkFunction() {
        const PASS_RESULT = { severity: 0 };
        if (location.protocol !== 'https:') return PASS_RESULT;
        let tags = document.querySelectorAll('img[src], object[data], audio[src], video[src]');
        let failures = "";
        for (let tag of tags) {
            let source = tag.tagName !== 'object' ? tag.getAttribute('src') : tag.getAttribute('data');
            if (source.split('/')[0] === 'http:') {
                failures += `
                    <li><code>${getCSSPath(tag)}</code> links to <code>${source}</code>. Change this to <code>${'https:' + source.substring(5)}</code></li>
                `
            }
        }
        if (!failures) return PASS_RESULT;
        return {
            severity: 10,
            remedy: `
                <p>The following tags link to insecure media. To fix, please change the sources as specified below.</p>
                <ul>${failures}</ul>
            `
        }
    }
}, {
    name: 'CSRF Protection',
    description: '',
    context: PAGE_CONTEXT,
    checkFunction() {
        const PASS_RESULT = {severity: 0};
        let forms = document.querySelectorAll('form');
        if (!forms) return PASS_RESULT;
        let failures = "";
        for (let form of forms) {
            if (!form.querySelectorAll('input[type=hidden]')) {
                failures += `<li><code>${getCSSPath(tag)}</code> contains no hidden fields, 
                             indicating that there is possibly no CSRF token included in the form.
                             Consider adding a CSRF token as a hidden field, and check the link for
                             more information.</li>`
            }
        }
        if (!failures) return PASS_RESULT;
        return {
            severity: 10,
            remedy: `
                <p>The following forms might not contain a CSRF token, leaving them vulnerable to cross-site request forgery:</p>
                <ul>${failures}</ul>
            `
        }
    }
}];

function getFunctionBody(func) {
    const funcStr = func.toString();
    return funcStr.slice(funcStr.indexOf("{") + 1, funcStr.lastIndexOf("}"));
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