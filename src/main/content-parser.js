import { parse as parse5 } from 'parse5';

const SVG_NS = 'http://www.w3.org/2000/svg';

const VOID_HTML = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const RE_MULTI_SPACE = /\s+/g;


export function extractTitle(html, doc) {
    const head = findHeadNode(doc || parse5(html));
    for (const child of head.childNodes || []) {
        if (child.nodeName === 'title') {
            return getTreeText(child).replace(RE_MULTI_SPACE, ' ').trim();
        }
    }
    return '';
}


export function extractMetaDescription(html, doc) {
    const head = findHeadNode(doc || parse5(html));
    for (const child of head.childNodes || []) {
        if (child.nodeName === 'meta' && getAttr(child, 'name').toLowerCase() === 'description') {
            return getAttr(child, 'content').trim();
        }
    }
    return '';
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


function findHeadNode(doc) {
    for (const child of doc.childNodes || []) {
        if (child.nodeName === 'html') {
            for (const el of child.childNodes || []) {
                if (el.nodeName === 'head') {
                    return el;
                }
            }
        }
    }
    return doc;
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


const BV_INLINE_TAGS = new Set(['a', 'strong', 'em', 'li']);
const BV_BLOCK_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p']);
const BV_SKIP_TAGS = new Set(['script', 'style', 'noscript', 'template']);

export function extractBotview(html, doc) {
    const body = findBodyNode(doc || parse5(html));
    const parts = [];
    appendBotviewChildren(body, parts);
    let text = parts.join('');
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/ *\n */g, '\n');
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
}


function appendBotviewChildren(parent, parts) {
    for (const child of parent.childNodes || []) {
        appendBotviewNode(child, parts);
    }
}


function appendBotviewNode(node, parts) {
    if (node.nodeName === '#text') {
        parts.push(node.value || '');
        return;
    }
    if (node.nodeName === '#comment') {
        return;
    }
    if (node.nodeName === '#document' || node.nodeName === '#document-fragment') {
        appendBotviewChildren(node, parts);
        return;
    }
    if (node.namespaceURI === SVG_NS) {
        return;
    }
    const tag = node.nodeName;
    if (BV_SKIP_TAGS.has(tag)) {
        return;
    }
    if (tag === 'br') {
        parts.push('\n');
        return;
    }
    if (tag === 'img') {
        const alt = getAttr(node, 'alt');
        if (alt) {
            parts.push('<img alt="' + alt + '" />');
        }
        return;
    }
    if (BV_BLOCK_TAGS.has(tag)) {
        parts.push('\n\n');
        if (tag !== 'p') {
            parts.push('<' + tag + '>');
        }
        appendBotviewChildren(node, parts);
        if (tag !== 'p') {
            parts.push('</' + tag + '>');
        }
        parts.push('\n\n');
        return;
    }
    if (BV_INLINE_TAGS.has(tag)) {
        parts.push('<' + tag + '>');
        appendBotviewChildren(node, parts);
        parts.push('</' + tag + '>');
        return;
    }
    appendBotviewChildren(node, parts);
}


export function parseSnapshot(html) {
    const doc = parse5(html);
    return {
        title: extractTitle(html, doc),
        meta_description: extractMetaDescription(html, doc),
        plaintext: extractPlaintext(html, doc),
        headlines_json: JSON.stringify(extractHeadlines(html, doc)),
        classes_ids_json: JSON.stringify(extractClassesAndIds(html, doc)),
        botview: extractBotview(html, doc),
    };
}
