messengerCSP = `Content-Security-Policy: default-src * data: blob:;script-src *.facebook.com *.fbcdn.net *.facebook.net *.google-analytics.com *.virtualearth.net *.google.com 127.0.0.1:* *.spotilocal.com:* 'unsafe-inline' 'unsafe-eval' blob: data: 'self' *.messenger.com;style-src data: blob: 'unsafe-inline' * *.messenger.com;connect-src *.facebook.com facebook.com *.fbcdn.net *.facebook.net *.spotilocal.com:* wss://*.facebook.com:* https://fb.scanandcleanlocal.com:* attachment.fbsbx.com ws://localhost:* blob: *.cdninstagram.com 'self' *.messenger.com wss://*.messenger.com:*;font-src *.messenger.com *.facebook.com static.xx.fbcdn.net data:;`;

// result for Content-Security-Policy: default-src *; script-src 'self' google.com
// {
//      default-src: ["*"],
//      script-src: ["'self", "google.com"]
// }
let processCSP = function (cspString) {
    let workingString = cspString;
    let result = {};
    workingString = workingString.replace("Content-Security-Policy:", "");
    let cspModes = workingString.split(";");
    cspModes.forEach(function (mode) {
        let [operator, ...arguments] = mode.split(/\s+/);
        result[operator] = arguments;
    });
    return result;
};

let checkCSP = function(cspString) {
    let csp = processCSP(cspString);

    let listOfResults = [];
    return csp;
};

console.log(checkCSP(messengerCSP));
