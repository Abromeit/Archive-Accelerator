import { decodeHTML } from 'entities';

const RE_HEAD_SPLIT = /<body(?:\s[^>]*)?>/i;
const RE_BODY_END = /<\/body\s*>/i;
const RE_TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const RE_META_DESC = /<meta\s[^>]*name\s*=\s*["']?description["']?[^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*\/?>/i;
const RE_META_DESC_ALT = /<meta\s[^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*name\s*=\s*["']?description["']?[^>]*\/?>/i;
const RE_HEADLINES = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
const RE_IMG_ALT = /<img\s[^>]*alt\s*=\s*["']([^"']*)["'][^>]*\/?>/gi;
const RE_SCRIPT_STYLE = /<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi;
const RE_COMMENTS = /<!--[\s\S]*?-->/g;
const RE_ALL_TAGS = /<[^>]+>/g;
const RE_CLASS = /\bclass\s*=\s*["']([^"']*)["']/gi;
const RE_ID = /\bid\s*=\s*["']([^"']*)["']/gi;
const RE_MULTI_SPACE = /\s+/g;

const RE_BV_IMG_QUOTED = /<img\s[^>]*?alt\s*=\s*(['"])(.*?)\1[^>]*?\/?>/gi;
const RE_BV_IMG_UNQUOTED = /<img\s[^>]*?alt\s*=\s*([\w-]+)[^>]*?\/?>/gi;
const RE_BV_BLOCK = /\s*(<\/?(?:h[1-6]|p)(?:\s[^>]*)?>)\s*/gi;
const RE_BV_INLINE = /<(\/?)(a|em|h[1-6]|strong|li)(?:\s[^>]*)?>/gi;
const RE_BV_BR = /\s*<br(?:\s[^>]*)?\/?>\s*/gi;
const RE_BV_STRIP = /<(?!__BV_T__|__BV_I__)[^>]*>/gi;
const RE_BV_MARKER_CLOSE = /[\p{Zs}+\t ]*<(?:__BV_T__|__BV_I__)(\/[^>]*)>/gu;
const RE_BV_MARKER_OPEN = /<(?:__BV_T__|__BV_I__)([^>]*)>[\p{Zs}+\t ]*/gu;
const RE_BV_HSPACE = /[\p{Zs}\t ]+/gu;
const RE_BV_SP_AFTER_NL = /([\r\n]+) +/g;
const RE_BV_SP_BEFORE_NL = / +([\r\n]+)/g;
const RE_BV_NL_AFTER_OPEN = /(<\w[^>]*>)\s*[\r\n]+/g;
const RE_BV_NL_BEFORE_CLOSE = /[\r\n]+\s*(<\/\w[^>]*>)/g;
const RE_BV_MULTI_BLANK = /[\r ]*?\n(?:[\r ]*?\n)+/g;
const RE_BV_TRIPLE_NL = /\n{3,}/g;
const RE_BV_CLOSE_SELF = /<(\/[^>]*|[^>]*\/)>/g;


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
    return decodeHtmlEntities(stripTags(match[1])).replace(RE_MULTI_SPACE, ' ').trim();
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

    body = body.replace(RE_COMMENTS, ' ');
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
            text: decodeHtmlEntities(stripTags(match[2]).replace(RE_MULTI_SPACE, ' ')).trim(),
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


export function extractBotview(html) {
    let text = getBody(html);

    text = text.replace(RE_COMMENTS, ' ');
    text = text.replace(RE_SCRIPT_STYLE, ' ');

    text = text.replace(RE_BV_IMG_QUOTED, ' <__BV_I__img alt="$2" /> ');
    text = text.replace(RE_BV_IMG_UNQUOTED, ' <__BV_I__img alt="$1" /> ');

    text = text.replace(RE_BV_BLOCK, '\n$1\n');

    text = text.replace(RE_BV_INLINE, ' <__BV_T__$1$2> ');

    text = text.replace(RE_BV_BR, '\n');

    text = text.replace(RE_BV_STRIP, ' ');

    text = text.replace(RE_BV_MARKER_CLOSE, '<$1>');
    text = text.replace(RE_BV_MARKER_OPEN, '<$1>');

    text = decodeHtmlEntities(text);

    text = text.replace(RE_BV_HSPACE, ' ');
    text = text.replace(RE_BV_SP_AFTER_NL, '$1');
    text = text.replace(RE_BV_SP_BEFORE_NL, '$1');
    text = text.replace(RE_BV_NL_AFTER_OPEN, '$1');
    text = text.replace(RE_BV_NL_BEFORE_CLOSE, '$1');
    text = text.replace(RE_BV_MULTI_BLANK, '\n\n');
    text = text.replace(RE_BV_TRIPLE_NL, '\n\n');
    text = text.replace(RE_BV_CLOSE_SELF, '<$1> ');
    text = text.replace(/></g, '> <');

    return text.trim();
}


export function parseSnapshot(html) {
    return {
        title: extractTitle(html),
        meta_description: extractMetaDescription(html),
        plaintext: extractPlaintext(html),
        headlines_json: JSON.stringify(extractHeadlines(html)),
        classes_ids_json: JSON.stringify(extractClassesAndIds(html)),
        botview: extractBotview(html),
    };
}


function stripTags(str) {
    return str.replace(RE_ALL_TAGS, ' ');
}


function decodeHtmlEntities(str) {
    return decodeHTML(str);
}
