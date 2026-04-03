const RE_HEAD_SPLIT = /<body(?:\s[^>]*)?>/i;
const RE_BODY_END = /<\/body\s*>/i;
const RE_TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const RE_META_DESC = /<meta\s[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*\/?>/i;
const RE_META_DESC_ALT = /<meta\s[^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*name\s*=\s*["']description["'][^>]*\/?>/i;
const RE_HEADLINES = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
const RE_IMG_ALT = /<img\s[^>]*alt\s*=\s*["']([^"']*)["'][^>]*\/?>/gi;
const RE_SCRIPT_STYLE = /<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi;
const RE_ALL_TAGS = /<[^>]+>/g;
const RE_CLASS = /\bclass\s*=\s*["']([^"']*)["']/gi;
const RE_ID = /\bid\s*=\s*["']([^"']*)["']/gi;
const RE_MULTI_SPACE = /\s+/g;


export function getHead(html) {
    const match = html.match(RE_HEAD_SPLIT);
    if (!match) return html;
    return html.slice(0, match.index);
}


export function getBody(html) {
    const startMatch = RE_HEAD_SPLIT.exec(html);
    if (!startMatch) return html;

    const bodyStart = startMatch.index + startMatch[0].length;
    const endMatch = RE_BODY_END.exec(html.slice(bodyStart));
    if (!endMatch) return html.slice(bodyStart);
    return html.slice(bodyStart, bodyStart + endMatch.index);
}


export function extractTitle(html) {
    const head = getHead(html);
    const match = head.match(RE_TITLE);
    if (!match) return '';
    return decodeHtmlEntities(stripTags(match[1])).trim();
}


export function extractMetaDescription(html) {
    const head = getHead(html);
    let match = head.match(RE_META_DESC);
    if (!match) {
        match = head.match(RE_META_DESC_ALT);
    }
    if (!match) return '';
    return decodeHtmlEntities(match[1]).trim();
}


export function extractPlaintext(html) {
    let body = getBody(html);

    body = body.replace(RE_SCRIPT_STYLE, ' ');

    body = body.replace(RE_IMG_ALT, function (_m, alt) {
        return ' ' + alt + ' ';
    });

    body = body.replace(RE_ALL_TAGS, ' ');

    body = decodeHtmlEntities(body);

    body = body.replace(RE_MULTI_SPACE, ' ').trim();
    return body;
}


export function extractHeadlines(html) {
    const body = getBody(html);
    const headlines = [];
    let match;

    RE_HEADLINES.lastIndex = 0;
    while ((match = RE_HEADLINES.exec(body)) !== null) {
        headlines.push({
            level: parseInt(match[1], 10),
            text: stripTags(match[2]).replace(RE_MULTI_SPACE, ' ').trim(),
        });
    }
    return headlines;
}


export function extractClassesAndIds(html) {
    const result = new Set();
    let match;

    RE_CLASS.lastIndex = 0;
    while ((match = RE_CLASS.exec(html)) !== null) {
        const classes = match[1].trim().split(/\s+/);
        for (let i = 0, i_max = classes.length; i < i_max; ++i) {
            if (classes[i]) result.add(classes[i]);
        }
    }

    RE_ID.lastIndex = 0;
    while ((match = RE_ID.exec(html)) !== null) {
        const id = match[1].trim();
        if (id) result.add('#' + id);
    }

    return Array.from(result).sort();
}


export function parseSnapshot(html) {
    return {
        title: extractTitle(html),
        meta_description: extractMetaDescription(html),
        plaintext: extractPlaintext(html),
        headlines_json: JSON.stringify(extractHeadlines(html)),
        classes_ids_json: JSON.stringify(extractClassesAndIds(html)),
    };
}


function stripTags(str) {
    return str.replace(RE_ALL_TAGS, ' ');
}


const ENTITY_MAP = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&bull;': '\u2022',
    '&mdash;': '\u2014',
    '&ndash;': '\u2013',
    '&laquo;': '\u00AB',
    '&raquo;': '\u00BB',
    '&trade;': '\u2122',
    '&reg;': '\u00AE',
    '&copy;': '\u00A9',
    '&hellip;': '\u2026',
    '&middot;': '\u00B7',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&ldquo;': '\u201C',
    '&rdquo;': '\u201D',
    '&eacute;': '\u00E9',
    '&egrave;': '\u00E8',
    '&uuml;': '\u00FC',
    '&ouml;': '\u00F6',
    '&auml;': '\u00E4',
    '&szlig;': '\u00DF',
    '&Auml;': '\u00C4',
    '&Ouml;': '\u00D6',
    '&Uuml;': '\u00DC',
    '&euro;': '\u20AC',
    '&pound;': '\u00A3',
    '&yen;': '\u00A5',
    '&cent;': '\u00A2',
    '&times;': '\u00D7',
    '&divide;': '\u00F7',
    '&plusmn;': '\u00B1',
    '&deg;': '\u00B0',
    '&para;': '\u00B6',
    '&sect;': '\u00A7',
    '&larr;': '\u2190',
    '&rarr;': '\u2192',
    '&uarr;': '\u2191',
    '&darr;': '\u2193',
};

const RE_ENTITY = /&(?:#(\d+)|#x([0-9a-fA-F]+)|(\w+));/g;

function decodeHtmlEntities(str) {
    return str.replace(RE_ENTITY, function (full, dec, hex, named) {
        if (named) {
            return ENTITY_MAP['&' + named + ';'] || full;
        }
        if (dec) {
            return String.fromCharCode(parseInt(dec, 10));
        }
        if (hex) {
            return String.fromCharCode(parseInt(hex, 16));
        }
        return full;
    });
}
