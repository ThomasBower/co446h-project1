const PAGE_CONTEXT = 'PAGE_CONTEXT';
const EXT_CONTEXT = 'EXT_CONTEXT';

const DefaultRules = [{
    name: 'SSL',
    description: '',
    link: 'https://developer.mozilla.org/en-US/docs/Glossary/https',
    context: PAGE_CONTEXT,
    checkFunction() {
        if (location.protocol === 'https:') return { severity: 0 };
        return {
            severity: 10,
            remedy: `
                <ul class="failures">
                    <li class="critical">This site, <code>${location}</code> uses HTTP, meaning that data is transmitted unsecured across the network.
                    Seek assistance from your web host to buy and set up a certificate.</li>
                </ul>`
        };
    }
}, {
    name: 'Mixed Active Content',
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
    name: 'Mixed Passive Content',
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
                severity += 0.2;
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
    description: 'Content Security Policy (CSP) is an added layer of security that helps to detect and mitigate certain types of attacks, including Cross Site Scripting (XSS) and data injection attacks. These attacks are used for everything from data theft to site defacement to distribution of malware.',
    link: 'https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity',
    context: PAGE_CONTEXT,
    checkFunction() {
        let tags = document.querySelectorAll('link, script');
        let failures = "";
        for (let tag of tags) {
            let source = tag.tagName.toLowerCase() === 'script' ? tag.src : tag.href;
            if (!source) continue;
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
}, {
    name: 'Content Security Policy (CSP)',
    description: '',
    link: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP',
    context: EXT_CONTEXT,
    checkFunction(requests) {
        const cspHeaderObject = requests.find(r => r.type === 'main_frame').responseHeaders.find(({ name }) => name.toLowerCase() === 'content-security-policy');
        if(!cspHeaderObject) {
            // if CSP does not exist, then no point in doing any more checks on it!
            return {
                severity: 10,
                remedy: "You do not have a Content Security Policy, please refer to the link to find more about how to create one and why you should."
            };
        }
        const cspString = cspHeaderObject.value;

        // -- PROCESS CSP INTO OBJ -------
        // variable 'csp' - for CSP below:
        // default-src *; script-src 'self' google.com
        // would be:
        // {
        //      default-src: ["*"],
        //      script-src: ["'self", "google.com"]
        // }
        let csp = {};
        let cspModes = cspString.trim().split(";");
        cspModes.forEach(function (mode) {
            let [operator, ...arguments] = mode.trim().split(/\s+/);
            csp[operator] = arguments;
        });
        // --------------------------------
        console.log(' ');
        console.log('----------------------------');
        console.log('------ CSP OBJECT ---------');
        console.log(csp);
        console.log('----------------------------');
        console.log(' ');

        let maxSeverity = 0;
        let failures = [];

        // --- CHECK -----
        // if a CSP has script-src it should also have object-src
        // if it has neither, it should have a default-src
        const xorScriptObjectSrcSeverity = 8;
        if(('script-src' in csp) && !('object-src' in csp)) {
            maxSeverity = Math.max(maxSeverity, xorScriptObjectSrcSeverity);
            failures.push(
                `<li class="critical">
                The CSP has a <code>script-src</code> directive but not a <code>object-src</code> directive.
                This can leave the page open to XSS attacks, because malicious code in a less secure policy
                can bypass the more secure policy, if part of <code>&lt;script&gt;</code> or <code>&lt;object>&gt;</code> tags. 
                <br> Severity ${xorScriptObjectSrcSeverity}.
            </li>`);
        } else if(!('script-src' in csp) && ('object-src' in csp)) {
            maxSeverity = Math.max(maxSeverity, xorScriptObjectSrcSeverity);
            failures.push(
                `<li class="critical">
                The CSP has a <code>object-src</code> directive but not a <code>script-src</code> directive.
                This can leave the page open to XSS attacks, because malicious code in a less secure policy
                can bypass the more secure policy, if part of <code>&lt;script&gt;</code> or <code>&lt;object>&gt;</code> tags. 
                <br> Severity ${xorScriptObjectSrcSeverity}.
            </li>`);
        } else if(!('script-src' in csp) && !('object-src' in csp) && !('default-src' in csp)) {
            maxSeverity = Math.max(maxSeverity, xorScriptObjectSrcSeverity);
            failures.push(
                `<li class="critical">
                The CSP has no <code>object-src</code>, <code>script-src</code> or <code>default-src</code>directives.
                This can leave the page open to XSS attacks,
                as you have no policy covering the content of <code>&lt;script&gt;</code> or <code>&lt;object>&gt;</code> tags. 
                <br>  Severity ${xorScriptObjectSrcSeverity}.
            </li>`);
        }
        // --------

        // --- CHECK -----
        // check for wildcard '*'
        let listOfDirectivesWhichHaveStarFailures = [];
        for(const [directive, sources] of Object.entries(csp)) {
            sources.forEach(function (src) {
                if(src === '*') {
                    listOfDirectivesWhichHaveStarFailures.push(directive);
                }
            });
        }
        if(listOfDirectivesWhichHaveStarFailures.length > 0) {
            let executableDirectives = ['default-src', 'script-src', 'object-src'];
            let starFailureSeverity;
            if(listOfDirectivesWhichHaveStarFailures.some((d) => executableDirectives.includes(d))) {
                // consider a * in the executable directives to be _slightly_ worse than other directives
                starFailureSeverity = 9;
            } else {
                starFailureSeverity = 7;
            }
            maxSeverity = Math.max(maxSeverity, starFailureSeverity);
            failures.push(
                `<li class="critical">
                The CSP is using a wildcard '<code>*</code>'
                for the following directive${listOfDirectivesWhichHaveStarFailures.length > 1 ? "s" : ""}:
                ${listOfDirectivesWhichHaveStarFailures.map((d) => `<code>${d}</code>`).join(", ")}.
                <br> Severity ${starFailureSeverity}.
            </li>`);
        }
        // --------

        // --- CHECK -----
        // unsafe-eval should not used at all
        let listOfDirectivesWhichUseUnsafeEval = [];
        for(const [directive, sources] of Object.entries(csp)) {
            sources.forEach(function (src) {
                if(src === "'unsafe-eval'") {
                    listOfDirectivesWhichUseUnsafeEval.push(directive);
                }
            });
        }
        if(listOfDirectivesWhichUseUnsafeEval.length > 0) {
            let unsafeEvalSeverity = 10;
            maxSeverity = Math.max(maxSeverity, unsafeEvalSeverity);
            failures.push(
                `<li class="critical">
                The CSP declares '<code>unsafeEval</code>' within directive${listOfDirectivesWhichUseUnsafeEval.length > 1 ? "s" : ""}:
                ${listOfDirectivesWhichUseUnsafeEval.map((d) => `<code>${d}</code>`).join(", ")}.
                <br> This allows for calls to javascript's <code>eval()</code>
                        method which allows for arbitrary code execution on the page,
                        possibly by attackers.
                <br>Severity ${unsafeEvalSeverity}.
            </li>`);
        }

        // --------

        // --- CHECK -----
        // unsafe-inline shouldn't be included without a nonce
        let listOfDirectivesWhichUseUnsafeInline = [];
        for(const [directive, sources] of Object.entries(csp)) {
            // look for unsafe-inline
            let foundUnsafeInline = false;
            sources.forEach(function (src) {
                if(src === "'unsafe-inline'") {
                    foundUnsafeInline = true;
                }
            });
            let foundNonce = false;
            if(foundUnsafeInline) {
                sources.forEach(function (src) {
                    if(src.includes("nonce")) {
                        foundNonce = true;
                    }
                });
            }
            if(foundUnsafeInline && !foundNonce) {
                listOfDirectivesWhichUseUnsafeInline.push(directive);
            }
        }
        if(listOfDirectivesWhichUseUnsafeInline.length > 0) {
            let unsafeInlineSeverity = 8;
            maxSeverity = Math.max(maxSeverity, unsafeInlineSeverity);
            failures.push(
                `<li class="critical">
                The CSP declares '<code>unsafe-inline</code>' within directive${listOfDirectivesWhichUseUnsafeEval.length > 1 ? "s" : ""}:
                ${listOfDirectivesWhichUseUnsafeEval.map((d) => `<code>${d}</code>`).join(", ")}.
                <br> This allows for inline <code>&lt;script&gt;</code> code, which may be subject to XSS.
                        Consider using a <code>nonce-</code> directive.
                <br>Severity ${unsafeInlineSeverity}.
            </li>`);
        }

        // --- RETURN RESULTS -----
        if(failures.length === 0) {
            return PASS_RESULT;
        } else {
            return {
                severity: maxSeverity,
                remedy: `
                <p>The CSP has the following problem${failures.length > 1 ? "s" : ""} with its Content Security Policy</p>
                <ul class="failures">${failures.join("")}</ul>
                `
            };
        }
    }
}].map(rule => ({
    ...rule, checkFunctionBody: getFunctionBody(rule.checkFunction)
}));

function getFunctionBody(func) {
    const funcStr = func.toString();
    return funcStr.slice(funcStr.indexOf("{") + 1, funcStr.lastIndexOf("}"));
}
