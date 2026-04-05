import { decodeHTML } from 'entities';
import { parse as parse5 } from 'parse5';

const SVG_NS = 'http://www.w3.org/2000/svg';

const VOID_HTML = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const RE_HEAD_SPLIT = /<body(?:\s[^>]*)?>/i;
const RE_BODY_END = /<\/body\s*>/i;
const RE_TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const RE_META_DESC = /<meta\s[^>]*name\s*=\s*["']?description["']?[^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*\/?>/i;
const RE_META_DESC_ALT = /<meta\s[^>]*content\s*=\s*["']([\s\S]*?)["'][^>]*name\s*=\s*["']?description["']?[^>]*\/?>/i;
const RE_COMMENTS = /<!--[\s\S]*?-->/g;
const RE_SCRIPT_STYLE = /<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi;
const RE_ALL_TAGS = /<[^>]+>/g;
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


export function extractPlaintext(html, doc) {
    const body = findBodyNode(doc || parse5(html));
    const out = { s: '' };
    appendPlaintextChildren(body, out);
    return out.s.replace(RE_MULTI_SPACE, ' ').trim();
}


export function extractHeadlines(html, doc) {
    const body = findBodyNode(doc || parse5(html));
    const headlines = [];

    function walk(node) {
        if (/^h[1-6]$/.test(node.nodeName || '')) {
            headlines.push({
                level: parseInt(node.nodeName[1], 10),
                text: getTreeText(node).replace(RE_MULTI_SPACE, ' ').trim(),
            });
            return;
        }
        for (const child of node.childNodes || []) {
            walk(child);
        }
    }

    walk(body);
    return headlines;
}


function findBodyNode(doc) {
    for (const child of doc.childNodes || []) {
        if (child.nodeName === 'html') {
            for (const el of child.childNodes || []) {
                if (el.nodeName === 'body') {
                    return el;
                }
            }
        }
    }
    return doc;
}


function getTreeText(node) {
    if (node.nodeName === '#text') return node.value || '';
    let result = '';
    for (const child of node.childNodes || []) {
        result += getTreeText(child);
    }
    return result;
}


function appendPlaintextChildren(parent, out) {
    for (const child of parent.childNodes || []) {
        appendPlaintextNode(child, out);
    }
}


function appendPlaintextNode(node, out) {
    if (node.nodeName === '#text') {
        out.s += node.value || '';
        return;
    }
    if (node.nodeName === '#comment') {
        return;
    }
    if (node.nodeName === '#document' || node.nodeName === '#document-fragment') {
        appendPlaintextChildren(node, out);
        return;
    }
    if (node.namespaceURI === SVG_NS) {
        return;
    }
    const tag = node.nodeName;
    if (tag === 'script' || tag === 'style' || tag === 'noscript') {
        return;
    }
    if (tag === 'template') {
        return;
    }
    if (tag === 'img') {
        out.s += ' ' + getAttr(node, 'alt') + ' ';
        return;
    }
    if (VOID_HTML.has(tag)) {
        out.s += ' ';
        return;
    }
    out.s += ' ';
    appendPlaintextChildren(node, out);
    out.s += ' ';
}


function getAttr(element, name) {
    const attrs = element.attrs;
    if (!attrs || !attrs.length) {
        return '';
    }
    for (const attr of attrs) {
        if (attr.name === name) {
            return attr.value || '';
        }
    }
    return '';
}


export function extractClassesAndIds(html, doc) {
    const result = new Set();
    doc = doc || parse5(html);

    function walk(node) {
        if (!node) {
            return;
        }
        if (node.nodeName === '#text' || node.nodeName === '#comment') {
            return;
        }
        if (node.nodeName === '#documentType') {
            return;
        }
        const attrs = node.attrs;
        if (attrs && attrs.length) {
            for (const a of attrs) {
                if (a.name === 'class') {
                    for (const cls of (a.value || '').trim().split(/\s+/)) {
                        if (cls) {
                            result.add(cls);
                        }
                    }
                }
                if (a.name === 'id') {
                    const id = (a.value || '').trim();
                    if (id) {
                        result.add('#' + id);
                    }
                }
            }
        }
        if (node.nodeName === 'template' && node.content) {
            for (const tChild of node.content.childNodes || []) {
                walk(tChild);
            }
            return;
        }
        for (const child of node.childNodes || []) {
            walk(child);
        }
    }

    walk(doc);
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
    const doc = parse5(html);
    return {
        title: extractTitle(html),
        meta_description: extractMetaDescription(html),
        plaintext: extractPlaintext(html, doc),
        headlines_json: JSON.stringify(extractHeadlines(html, doc)),
        classes_ids_json: JSON.stringify(extractClassesAndIds(html, doc)),
        botview: extractBotview(html),
    };
}


function stripTags(str) {
    return str.replace(RE_ALL_TAGS, ' ');
}


function decodeHtmlEntities(str) {
    return decodeHTML(str);
}
