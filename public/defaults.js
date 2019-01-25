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
            remedy: `
                <ul class="failures">
                    <li class="non-critical">This site, <code>${location}</code> uses HTTP, meaning that data is transmitted unsecured across the network.
                    Seek assistance from your web host to buy and set up a certificate.</li>
                </ul>`
        };
    }
}, {
    name: 'No Mixed Active Content',
    description: '',
    link: 'https://developer.mozilla.org/en-US/docs/Security/Mixed_content#Mixed_active_content',
    context: PAGE_CONTEXT,
    checkFunction() {
        const PASS_RESULT = { severity: 0 };
        if (location.protocol !== 'https:') return PASS_RESULT;
        let tags = document.querySelectorAll('script[src], form[action], iframe[src], embed[src], source[src], param[value], a[href]');
        let failures = "";
        for (let tag of tags) {
            let source;
            switch (tag.tagName.toLowerCase()) {
                case 'script':
                case 'iframe':
                case 'embed':
                case 'source':
                    source = tag.src;
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
            if (!source) continue;
            if (source.split('/')[0] === 'http:') {
                failures += `
                    <li class="critical"><code>${getCSSPath(tag)}</code> links to <code>${source}</code>. Change this to <code>${'https:' + source.substring(5)}</code> to avoid mixed active content.</li>
                `
            }
        }
        return failures ? {
            severity: 6,
            remedy: `
                <p>Resources on HTTPS pages should be loaded over HTTPS. The following resources are loaded over HTTP:</p>
                <ul class="failures">${failures}</ul>
            `
        } : PASS_RESULT;
    }
}, {
    name: 'No Mixed Passive Content',
    description: '',
    link: 'https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content#Mixed_passivedisplay_content',
    context: PAGE_CONTEXT,
    checkFunction() {
        const PASS_RESULT = { severity: 0 };
        if (location.protocol !== 'https:') return PASS_RESULT;
        let tags = document.querySelectorAll('img[src], object[data], audio[src], video[src]');
        let failures = "";
        for (let tag of tags) {
            let source = tag.tagName.toLowerCase() !== 'object' ? tag.src : tag.getAttribute('data');
            if (source.split('/')[0] === 'http:') {
                failures += `
                    <li class="non-critical"><code>${getCSSPath(tag)}</code> links to <code>${source}</code>. Change this to <code>${'https:' + source.substring(5)}</code></li>
                `
            }
        }
        return failures ? {
            severity: 10,
            remedy: `<p>The following tags link to insecure media. To fix, please change the sources as specified below.</p>
                     <ul class="failures">${failures}</ul>
            `
        } : PASS_RESULT;
    }
}, {
    name: 'CSRF Protection',
    description: '',
    link: 'https://www.owasp.org/index.php/Cross-Site_Request_Forgery_(CSRF)_Prevention_Cheat_Sheet',
    context: PAGE_CONTEXT,
    checkFunction() {
        const PASS_RESULT = { severity: 0 };
        let forms = document.querySelectorAll('form[action]');
        if (!forms) return PASS_RESULT;
        let failures = "", severity = 0;
        for (let form of forms) {
            if (Array.from(form.querySelectorAll('input[type="hidden"]')).length === 0) {
                severity += 3;
                failures += `<li class="critical"><code>${getCSSPath(form)}</code> contains no hidden fields, 
                             indicating that there is possibly no CSRF token included in the form.
                             Consider adding a CSRF token as a hidden field, and check the link for
                             more information.</li>`;
                continue;
            }
            if (!Array.from(form.querySelectorAll('input[type="hidden"]')).some(input => entropy(input.value) > SUITABLE_ENTROPY)) {
                severity += 0.5;
                failures += `<li class="non-critical"><code>${getCSSPath(form)}</code> contains hidden fields, 
                             however the value has a low entropy indicating that it may
                             not include a CSRF token.</li>`;
            }
        }
        return failures ? {
            severity,
            remedy: `
                <p>The following forms might not contain a CSRF token, leaving them vulnerable to cross-site request forgery:</p>
                <ul class="failures">${failures}</ul>
            `
        } : PASS_RESULT;
    }
}, {
    name: 'Subresource Integrity',
    description: '',
    link: 'https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity',
    context: PAGE_CONTEXT,
    checkFunction() {
        log("YAAT")
        let tags = document.querySelectorAll('link, script');
        let failures = "";
        for (let tag of tags) {
            let source = tag.tagName.toLowerCase() === 'script' ? tag.src : tag.href;
            if (!source) continue;
            log("HERE");
            if (location.host !== source.split('/')[2]) {
                failures += `<li class="non-critical"><code>${getCSSPath(tag)}</code> for source <code>${source}</code>
                             does not contain an <code>integrity</code> attribute. You can fix this by adding generating
                             a hash <a href="https://www.srihash.org" target="_blank">here</a>.</li>`;
            }
        }
        return failures ? {
            severity: 2,
            remedy: `
                <p>External sources should include an integrity tag to avoid malicious code injection.
                The following tags contain external sources without an integrity tag:</p>
                <ul class="failures">${failures}</ul>
            `
        } : { severity: 0 };
    }
}];

function getFunctionBody(func) {
    const funcStr = func.toString();
    return funcStr.slice(funcStr.indexOf("{") + 1, funcStr.lastIndexOf("}"));
}