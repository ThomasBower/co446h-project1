const PAGE_CONTEXT = 'PAGE_CONTEXT';
const EXT_CONTEXT = 'EXT_CONTEXT';

chrome.runtime.onInstalled.addListener(function(details){
    chrome.storage.sync.set({ defaultRules });
});

const defaultRules = [{
    name: 'Uses SSL',
    description: '',
    context: PAGE_CONTEXT,
    checkFunctionBody: `
        return {
            severity: location.protocol === 'https:' ? 0 : 3
        };
    `
}, {
    name: 'No Mixed Active Content',
    description: '',
    context: PAGE_CONTEXT,
    checkFunctionBody: `
        const PASS_RESULT = { severity: 0 };
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
    `
}, {
    name: 'No Mixed Passive Content',
    description: '',
    context: PAGE_CONTEXT,
    checkFunctionBody: `
        const PASS_RESULT = { severity: 0 };
        if (location.protocol !== 'https:') return PASS_RESULT;
        let tags = document.querySelectorAll('img[src], object[data], audio[src],' + 'video[src]');
        for (let tag of tags) {
            let source = tag.tagName !== 'object' ?
            tag.getAttribute('src') : tag.getAttribute('data');
            if (source.split('/')[0] === 'http:') {
                return {
                    severity: 1
                };
            }
        }
        return PASS_RESULT;
    `
}];