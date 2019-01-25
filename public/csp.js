let messengerCSP = `default-src * data: blob:;script-src *.facebook.com *.fbcdn.net *.facebook.net *.google-analytics.com *.virtualearth.net *.google.com 127.0.0.1:* *.spotilocal.com:* 'unsafe-inline' 'unsafe-eval' blob: data: 'self' *.messenger.com;style-src data: blob: 'unsafe-inline' * *.messenger.com;connect-src *.facebook.com facebook.com *.fbcdn.net *.facebook.net *.spotilocal.com:* wss://*.facebook.com:* https://fb.scanandcleanlocal.com:* attachment.fbsbx.com ws://localhost:* blob: *.cdninstagram.com 'self' *.messenger.com wss://*.messenger.com:*;font-src *.messenger.com *.facebook.com static.xx.fbcdn.net data:;`;
let noDefaultTwoStars = "img-src *; media-src *; style-src: 'self'";
let unsafeEval = "default-src 'unsafe-eval'";
let unsafeInline = "default-src 'unsafe-inline'";

const PASS_RESULT = {
    severity: 0
};

// link=https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
function checkFunction(testCspString) { // TODO this won't be the actual args
     //TODO GET CSP-STRING FROM ACTUAL SITE
    let cspString = testCspString;
    if(false) { // TODO: IF (CSP DOES NOT EXIST)
        // if CSP does not exist, then no point in doing any more checks on it!
        return {
            severity: 10,
            remedy: "You do not have a Content Security Policy," +
                "please refer to the link to find more" +
                "about how to create one and why you should."
        };
    }

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
    if(('script-src' in csp) && !('object-src' in csp)) {
        maxSeverity = Math.max(maxSeverity, 8);
        failures.push(
            `<li class="critical">
                The CSP has a <code>script-src</code> directive but not a <code>object-src</code> directive.
                This can leave the page open to XSS attacks, because malicious code in a less secure policy
                can bypass the more secure policy, if part of <code>&lt;script&gt;</code> or <code>&lt;object>&gt;</code> tags. 
            </li>`);
    } else if(!('script-src' in csp) && ('object-src' in csp)) {
        maxSeverity = Math.max(maxSeverity, 8);
        failures.push(
            `<li class="critical">
                The CSP has a <code>object-src</code> directive but not a <code>script-src</code> directive.
                This can leave the page open to XSS attacks, because malicious code in a less secure policy
                can bypass the more secure policy, if part of <code>&lt;script&gt;</code> or <code>&lt;object>&gt;</code> tags. 
            </li>`);
    } else if(!('script-src' in csp) && !('object-src' in csp) && !('default-src' in csp)) {
        maxSeverity = Math.max(maxSeverity, 8);
        failures.push(
            `<li class="critical">
                The CSP has no <code>object-src</code>, <code>script-src</code> or <code>default-src</code>directives.
                This can leave the page open to XSS attacks,
                as you have no policy covering the content of <code>&lt;script&gt;</code> or <code>&lt;object>&gt;</code> tags. 
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
                <br> ${listOfDirectivesWhichHaveStarFailures.join(", ")}.
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
                <br> ${listOfDirectivesWhichUseUnsafeEval.join(", ")}.
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
                <br> ${listOfDirectivesWhichUseUnsafeEval.join(", ")}.
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
                <ul class="failures">${failures.join()}</ul>
                `
        };
    }
}

// console.log(checkFunction(messengerCSP));
// console.log(checkFunction(noDefaultTwoStars));
console.log(checkFunction(unsafeEval));
console.log(checkFunction(unsafeInline));
