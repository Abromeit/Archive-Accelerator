import { describe, it, expect } from 'vitest';
import {
    getHead,
    getBody,
    extractTitle,
    extractMetaDescription,
    extractPlaintext,
    extractHeadlines,
    extractClassesAndIds,
    extractBotview,
    parseSnapshot,
} from './content-parser.js';


// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MINIMAL_PAGE = `<!DOCTYPE html><html><head>
<title>Hello World</title>
<meta name="description" content="A simple page">
</head><body><p>Content here</p></body></html>`;

const UNQUOTED_ATTRS_PAGE = `<!DOCTYPE html><html lang=de><head><meta charset=UTF-8>` +
    `<meta name=viewport content="width=device-width, initial-scale=1, user-scalable=no">` +
    `<title>SEO Agentur KOCH ESSEN &bull; Full-Service und SEO Beratung</title>` +
    `<meta name=description content="Zuverlässige SEO-Agentur in Essen">` +
    `</head><body><h1>Willkommen</h1><p>Text</p></body></html>`;

const REAL_WORLD_KOCH_HEAD = `<!DOCTYPE html><html lang=de><head><meta charset=UTF-8>` +
    `<meta name=viewport content="width=device-width, initial-scale=1, user-scalable=no">` +
    `<meta name=mobile-web-app-capable content=yes>` +
    `<meta name=apple-mobile-web-app-capable content=yes>` +
    `<meta name=application-name content="KOCH ESSEN">` +
    `<title>SEO Agentur KOCH ESSEN &bull; Full-Service und SEO Beratung</title>` +
    `<script>var x = 1;</script>` +
    ` <meta name=description content="Zuverlässige SEO-Agentur in Essen – SEO-Beratung, Strategie, Markenaufbau, Technical SEO – Wir sorgen dafür, dass Google Sie gut findet. Jetzt Anfragen!">` +
    `<meta name=robots content="max-snippet:-1, max-image-preview:large, max-video-preview:-1">` +
    `</head><body><h1>Main heading</h1><p>paragraph</p></body></html>`;

const CONTENT_BEFORE_NAME = `<html><head>` +
    `<meta content="Reversed order description" name="description">` +
    `</head><body><p>Body</p></body></html>`;

const SINGLE_QUOTED = `<html><head>` +
    `<meta name='description' content='Single quoted desc'>` +
    `<title>Single 'quoted' title</title>` +
    `</head><body></body></html>`;

const NO_META = `<html><head><title>No Meta</title></head><body><p>Just text</p></body></html>`;

const NO_TITLE = `<html><head><meta name="description" content="Has desc"></head><body></body></html>`;

const ENTITIES_IN_TITLE = `<html><head>` +
    `<title>Company &amp; Co &ndash; Best &quot;Products&quot;</title>` +
    `<meta name="description" content="&lt;strong&gt;Bold&lt;/strong&gt; &amp; more">` +
    `</head><body></body></html>`;

const COMPLEX_BODY = `<html><head><title>Test</title></head><body>` +
    `<script>var x = "do not extract";</script>` +
    `<style>.cls { color: red; }</style>` +
    `<noscript><p>noscript content</p></noscript>` +
    `<!-- This is a comment that should not appear -->` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 10 H 90 V 90 H 10 Z"/><text>svg text</text></svg>` +
    `<h1>Main <strong>Title</strong></h1>` +
    `<p>First paragraph.</p>` +
    `<img src="photo.jpg" alt="A nice photo" />` +
    `<h2>Subtitle</h2>` +
    `<p>Second paragraph with &amp; entity.</p>` +
    `<h3 class="small">Third level</h3>` +
    `</body></html>`;

const CLASSES_AND_IDS = `<html><head></head><body>` +
    `<div class="container main-wrap" id="app">` +
    `<nav class="nav primary-nav">` +
    `<ul id="menu-list"><li class="nav">Item</li></ul>` +
    `</nav></div></body></html>`;

const NO_BODY_TAG = `<html><head><title>Headless</title>` +
    `<meta name="description" content="Desc without body tag"></head>` +
    `Some content without body tags`;

const MULTILINE_META = `<html><head>
<meta
    name="description"
    content="Multiline
meta description value">
<title>Multiline Test</title>
</head><body></body></html>`;

const META_IN_BODY = `<html><head><title>Head Title</title>` +
    `<meta name="description" content="Head description">` +
    `</head><body>` +
    `<meta name="description" content="Body description should be ignored">` +
    `<p>Content</p></body></html>`;

const TITLE_IN_BODY = `<html><head>` +
    `<meta name="description" content="desc">` +
    `</head><body>` +
    `<title>Body Title</title>` +
    `<p>Content</p></body></html>`;

const HEADLINES_NESTED = `<html><head></head><body>` +
    `<h1><a href="/">Home <span>Page</span></a></h1>` +
    `<h2>About <em>Us</em></h2>` +
    `<h3>Sub &amp; Section</h3>` +
    `<h4>Level 4</h4>` +
    `<h5>Level 5</h5>` +
    `<h6>Level 6</h6>` +
    `</body></html>`;

const EMPTY_HTML = '';

const SELF_CLOSING_META = `<html><head>` +
    `<meta name="description" content="Self closing" />` +
    `<title>Self Closing</title>` +
    `</head><body></body></html>`;


// ---------------------------------------------------------------------------
// getHead
// ---------------------------------------------------------------------------

describe('getHead', function () {
    it('returns content before <body>', function () {
        const head = getHead(MINIMAL_PAGE);
        expect(head).toContain('<title>Hello World</title>');
        expect(head).not.toContain('<p>Content here</p>');
    });

    it('returns full string when no <body> tag exists', function () {
        expect(getHead(NO_BODY_TAG)).toBe(NO_BODY_TAG);
    });

    it('handles empty input', function () {
        expect(getHead('')).toBe('');
    });

    it('returns full string for a fragment with no <body> tag', function () {
        expect(getHead('<p>Fragment only</p>')).toBe('<p>Fragment only</p>');
    });

    it('returns content before <body> when only <body> wrapper is present', function () {
        expect(getHead('<body><p>Hi</p></body>')).toBe('');
    });
});


// ---------------------------------------------------------------------------
// getBody
// ---------------------------------------------------------------------------

describe('getBody', function () {
    it('returns content between <body> and </body>', function () {
        const body = getBody(MINIMAL_PAGE);
        expect(body).toContain('<p>Content here</p>');
        expect(body).not.toContain('<title>');
    });

    it('returns content after <body> when no </body> exists', function () {
        const html = '<html><head></head><body><p>Open body';
        const body = getBody(html);
        expect(body).toContain('<p>Open body');
    });

    it('returns full string when no <body> tag exists', function () {
        expect(getBody(NO_BODY_TAG)).toBe(NO_BODY_TAG);
    });

    it('handles empty input', function () {
        expect(getBody('')).toBe('');
    });

    it('handles body tag with attributes', function () {
        const html = '<html><head></head><body class="dark" data-theme="night"><p>Hi</p></body></html>';
        expect(getBody(html)).toBe('<p>Hi</p>');
    });

    it('returns inner markup when <body> exists without <html> wrapper', function () {
        expect(getBody('<body><p>In body only</p></body>')).toBe('<p>In body only</p>');
    });

    it('returns full document when <html> has no <body> (HTML5 body-optional)', function () {
        const html = '<html><head><title>Head title</title></head><p>Direct under html</p></html>';
        expect(getBody(html)).toBe(html);
    });

    it('returns a fragment unchanged when there is no <body> tag', function () {
        expect(getBody('<p>Fragment only</p>')).toBe('<p>Fragment only</p>');
    });

    it('returns content after <!DOCTYPE> when <body> is missing', function () {
        const html = '<!DOCTYPE html><p>After doctype</p>';
        expect(getBody(html)).toBe(html);
    });
});


// ---------------------------------------------------------------------------
// extractTitle
// ---------------------------------------------------------------------------

describe('extractTitle', function () {
    it('extracts a basic title', function () {
        expect(extractTitle(MINIMAL_PAGE)).toBe('Hello World');
    });

    it('decodes HTML entities in title', function () {
        expect(extractTitle(UNQUOTED_ATTRS_PAGE)).toBe('SEO Agentur KOCH ESSEN \u2022 Full-Service und SEO Beratung');
    });

    it('decodes &amp;, &ndash;, &quot; in title', function () {
        expect(extractTitle(ENTITIES_IN_TITLE)).toBe('Company & Co \u2013 Best "Products"');
    });

    it('returns empty string when no title exists', function () {
        expect(extractTitle(NO_TITLE)).toBe('');
    });

    it('returns empty string for empty input', function () {
        expect(extractTitle(EMPTY_HTML)).toBe('');
    });

    it('strips tags inside title element', function () {
        const html = '<html><head><title>Bold <b>Title</b></title></head><body></body></html>';
        expect(extractTitle(html)).toBe('Bold Title');
    });

    it('only extracts title from head, not body', function () {
        expect(extractTitle(TITLE_IN_BODY)).toBe('');
    });

    it('extracts title from head when <html> has no <body> tag', function () {
        const html = '<html><head><title>Head title</title></head><p>Direct under html</p></html>';
        expect(extractTitle(html)).toBe('Head title');
    });

    it('returns empty string for a fragment with no <head> or <title>', function () {
        expect(extractTitle('<p>Fragment only</p>')).toBe('');
    });
});


// ---------------------------------------------------------------------------
// extractMetaDescription
// ---------------------------------------------------------------------------

describe('extractMetaDescription', function () {
    it('extracts double-quoted meta description', function () {
        expect(extractMetaDescription(MINIMAL_PAGE)).toBe('A simple page');
    });

    it('extracts meta description with unquoted name attribute', function () {
        expect(extractMetaDescription(UNQUOTED_ATTRS_PAGE)).toBe('Zuverlässige SEO-Agentur in Essen');
    });

    it('extracts from real-world HTML with many meta tags before description', function () {
        expect(extractMetaDescription(REAL_WORLD_KOCH_HEAD)).toBe(
            'Zuverlässige SEO-Agentur in Essen \u2013 SEO-Beratung, Strategie, Markenaufbau, ' +
            'Technical SEO \u2013 Wir sorgen dafür, dass Google Sie gut findet. Jetzt Anfragen!'
        );
    });

    it('handles content before name (reversed attribute order)', function () {
        expect(extractMetaDescription(CONTENT_BEFORE_NAME)).toBe('Reversed order description');
    });

    it('handles single-quoted attributes', function () {
        expect(extractMetaDescription(SINGLE_QUOTED)).toBe('Single quoted desc');
    });

    it('handles self-closing meta tag', function () {
        expect(extractMetaDescription(SELF_CLOSING_META)).toBe('Self closing');
    });

    it('returns empty string when no meta description exists', function () {
        expect(extractMetaDescription(NO_META)).toBe('');
    });

    it('returns empty string for empty input', function () {
        expect(extractMetaDescription(EMPTY_HTML)).toBe('');
    });

    it('decodes HTML entities in meta description', function () {
        expect(extractMetaDescription(ENTITIES_IN_TITLE)).toBe('<strong>Bold</strong> & more');
    });

    it('handles multiline content attribute', function () {
        expect(extractMetaDescription(MULTILINE_META)).toBe('Multiline\nmeta description value');
    });

    it('only extracts from head, not body', function () {
        expect(extractMetaDescription(META_IN_BODY)).toBe('Head description');
    });
});


// ---------------------------------------------------------------------------
// extractPlaintext
// ---------------------------------------------------------------------------

describe('extractPlaintext', function () {
    it('extracts text content from body', function () {
        expect(extractPlaintext(MINIMAL_PAGE)).toBe('Content here');
    });

    it('strips script, style, noscript, svg and comments', function () {
        const text = extractPlaintext(COMPLEX_BODY);
        expect(text).not.toContain('do not extract');
        expect(text).not.toContain('color: red');
        expect(text).not.toContain('noscript content');
        expect(text).not.toContain('M10 10');
        expect(text).not.toContain('svg text');
        expect(text).not.toContain('comment that should not appear');
    });

    it('replaces img tags with alt text surrounded by spaces', function () {
        const text = extractPlaintext(COMPLEX_BODY);
        expect(text).toContain('A nice photo');
    });

    it('decodes HTML entities', function () {
        const text = extractPlaintext(COMPLEX_BODY);
        expect(text).toContain('&');
        expect(text).not.toContain('&amp;');
    });

    it('collapses multiple spaces into one', function () {
        const text = extractPlaintext(COMPLEX_BODY);
        expect(text).not.toMatch(/  /);
    });

    it('does not include head content', function () {
        const text = extractPlaintext(MINIMAL_PAGE);
        expect(text).not.toContain('Hello World');
    });

    it('returns empty-ish for empty body', function () {
        const html = '<html><head></head><body></body></html>';
        expect(extractPlaintext(html).trim()).toBe('');
    });

    it('extracts text from a fragment with no html or body tags', function () {
        expect(extractPlaintext('<p>Fragment only</p>')).toBe('Fragment only');
    });

    it('extracts from <body> without <html> wrapper', function () {
        expect(extractPlaintext('<body><p>In body only</p></body>')).toBe('In body only');
    });

    it('includes head title text when <html> has no <body> (full document is treated as body)', function () {
        const html = '<html><head><title>Head title</title></head><p>Direct under html</p></html>';
        expect(extractPlaintext(html)).toBe('Head title Direct under html');
    });

    it('handles <!DOCTYPE> followed by content without <body>', function () {
        expect(extractPlaintext('<!DOCTYPE html><p>After doctype</p>')).toBe('After doctype');
    });
});


// ---------------------------------------------------------------------------
// extractHeadlines
// ---------------------------------------------------------------------------

describe('extractHeadlines', function () {
    it('extracts all headline levels', function () {
        const headlines = extractHeadlines(HEADLINES_NESTED);
        expect(headlines).toHaveLength(6);
        expect(headlines[0]).toEqual({ level: 1, text: 'Home Page' });
        expect(headlines[1]).toEqual({ level: 2, text: 'About Us' });
        expect(headlines[2]).toEqual({ level: 3, text: 'Sub & Section' });
        expect(headlines[3]).toEqual({ level: 4, text: 'Level 4' });
        expect(headlines[4]).toEqual({ level: 5, text: 'Level 5' });
        expect(headlines[5]).toEqual({ level: 6, text: 'Level 6' });
    });

    it('extracts headlines from complex body', function () {
        const headlines = extractHeadlines(COMPLEX_BODY);
        expect(headlines).toHaveLength(3);
        expect(headlines[0]).toEqual({ level: 1, text: 'Main Title' });
        expect(headlines[1]).toEqual({ level: 2, text: 'Subtitle' });
        expect(headlines[2]).toEqual({ level: 3, text: 'Third level' });
    });

    it('strips nested HTML tags from headline text', function () {
        const headlines = extractHeadlines(HEADLINES_NESTED);
        expect(headlines[0].text).toBe('Home Page');
        expect(headlines[1].text).toBe('About Us');
    });

    it('returns empty array when no headlines', function () {
        expect(extractHeadlines(MINIMAL_PAGE)).toEqual([]);
    });

    it('only extracts from body, not head', function () {
        const html = '<html><head></head><body><h1>Real</h1></body></html>';
        const headlines = extractHeadlines(html);
        expect(headlines).toHaveLength(1);
        expect(headlines[0].text).toBe('Real');
    });

    it('handles h2 inside div where </div> closes both (real-world broken HTML)', function () {
        const html = '<html><head></head><body>' +
            '<div class="header-main"><h2 class="font-boldest">About us.</div>' +
            '<div class="header-sub">Long body text that should not be part of heading.</div>' +
            '<h2>Next heading.</h2>' +
            '</body></html>';
        const headlines = extractHeadlines(html);
        expect(headlines).toHaveLength(2);
        expect(headlines[0]).toEqual({ level: 2, text: 'About us.' });
        expect(headlines[1]).toEqual({ level: 2, text: 'Next heading.' });
    });

    it('produces identical headlines for same content with different raw nesting', function () {
        const broken = '<html><head></head><body>' +
            '<div class="wrap"><h2>Title.</div><div class="sub">Body text</div>' +
            '<h3>Sub</h3></body></html>';
        const clean = '<html><head></head><body>' +
            '<div class="wrap"><h2>Title.</h2></div><div class="sub">Body text</div>' +
            '<h3>Sub</h3></body></html>';
        expect(extractHeadlines(broken)).toEqual(extractHeadlines(clean));
    });
});


// ---------------------------------------------------------------------------
// extractClassesAndIds
// ---------------------------------------------------------------------------

describe('extractClassesAndIds', function () {
    it('extracts class names and IDs', function () {
        const result = extractClassesAndIds(CLASSES_AND_IDS);
        expect(result).toContain('container');
        expect(result).toContain('main-wrap');
        expect(result).toContain('nav');
        expect(result).toContain('primary-nav');
        expect(result).toContain('#app');
        expect(result).toContain('#menu-list');
    });

    it('deduplicates class names', function () {
        const result = extractClassesAndIds(CLASSES_AND_IDS);
        const navCount = result.filter(function (x) { return x === 'nav'; }).length;
        expect(navCount).toBe(1);
    });

    it('returns sorted array', function () {
        const result = extractClassesAndIds(CLASSES_AND_IDS);
        const sorted = [...result].sort();
        expect(result).toEqual(sorted);
    });

    it('returns empty array for HTML without classes/ids', function () {
        const html = '<html><body><p>Plain</p></body></html>';
        expect(extractClassesAndIds(html)).toEqual([]);
    });
});


// ---------------------------------------------------------------------------
// extractBotview
// ---------------------------------------------------------------------------

const BV_COMPLEX = '<html><head><title>Test</title></head><body>' +
    '<script>var x = "do not extract";</script>' +
    '<style>.cls { color: red; }</style>' +
    '<noscript><p>noscript content</p></noscript>' +
    '<!-- This is a comment -->' +
    '<svg xmlns="http://www.w3.org/2000/svg"><text>svg text</text></svg>' +
    '<h1>Main <strong>Title</strong></h1>' +
    '<p>First paragraph.</p>' +
    '<img src="photo.jpg" alt="A nice photo" />' +
    '<h2>Subtitle</h2>' +
    '<p>Second paragraph with &amp; entity.</p>' +
    '<h3 class="small">Third level</h3>' +
    '</body></html>';

describe('extractBotview', function () {

    // --- Tag preservation ---

    it('preserves h1 tags, strips attributes', function () {
        const html = '<html><head></head><body><h1 class="title" id="main">Hello</h1></body></html>';
        expect(extractBotview(html)).toBe('<h1>Hello</h1>');
    });

    it('preserves h2-h6 tags', function () {
        for (let i = 2; i <= 6; ++i) {
            const html = `<html><head></head><body><h${i}>Heading</h${i}></body></html>`;
            expect(extractBotview(html)).toBe(`<h${i}>Heading</h${i}>`);
        }
    });

    it('preserves a tags, strips href', function () {
        expect(extractBotview(
            '<html><head></head><body><a href="/about" class="link">About</a></body></html>'
        )).toBe('<a>About</a>');
    });

    it('preserves strong tags', function () {
        expect(extractBotview(
            '<html><head></head><body><strong>Bold</strong></body></html>'
        )).toBe('<strong>Bold</strong>');
    });

    it('preserves em tags', function () {
        expect(extractBotview(
            '<html><head></head><body><em>Italic</em></body></html>'
        )).toBe('<em>Italic</em>');
    });

    it('preserves li tags', function () {
        expect(extractBotview(
            '<html><head></head><body><li>Item</li></body></html>'
        )).toBe('<li>Item</li>');
    });

    it('preserves img with quoted alt text', function () {
        expect(extractBotview(
            '<html><head></head><body><img src="photo.jpg" alt="A photo" /></body></html>'
        )).toBe('<img alt="A photo" />');
    });

    it('preserves img with unquoted alt text', function () {
        expect(extractBotview(
            '<html><head></head><body><img src="x.jpg" alt=landscape></body></html>'
        )).toBe('<img alt="landscape" />');
    });

    it('strips img without alt attribute', function () {
        expect(extractBotview(
            '<html><head></head><body><img src="photo.jpg" /></body></html>'
        )).toBe('');
    });

    it('handles nested preserved tags', function () {
        const result = extractBotview(
            '<html><head></head><body><h2><a href="/">Click <strong>here</strong></a></h2></body></html>'
        );
        expect(result).toContain('<h2>');
        expect(result).toContain('</h2>');
        expect(result).toContain('<a>');
        expect(result).toContain('</a>');
        expect(result).toContain('<strong>');
        expect(result).toContain('here');
        expect(result).not.toContain('href');
    });

    // --- Tag stripping ---

    it('strips div, span, table, nav and other non-preserved tags', function () {
        expect(extractBotview(
            '<html><head></head><body><div class="wrap"><span>Inside</span></div></body></html>'
        )).toBe('Inside');
    });

    it('extracts plain text from paragraphs', function () {
        expect(extractBotview(
            '<html><head></head><body><p>Hello world</p></body></html>'
        )).toBe('Hello world');
    });

    // --- Removal of non-content elements ---

    it('removes script tags and content', function () {
        const result = extractBotview(
            '<html><head></head><body><script>alert(1)</script>Text</body></html>'
        );
        expect(result).not.toContain('alert');
        expect(result).toContain('Text');
    });

    it('removes style tags and content', function () {
        const result = extractBotview(
            '<html><head></head><body><style>.x{color:red}</style>Text</body></html>'
        );
        expect(result).not.toContain('color');
        expect(result).toContain('Text');
    });

    it('removes HTML comments', function () {
        const result = extractBotview(
            '<html><head></head><body><!-- secret comment -->Text</body></html>'
        );
        expect(result).not.toContain('secret');
        expect(result).toContain('Text');
    });

    it('removes noscript and svg elements', function () {
        const result = extractBotview(
            '<html><head></head><body><noscript>No JS</noscript><svg><text>SVG</text></svg>Text</body></html>'
        );
        expect(result).not.toContain('No JS');
        expect(result).not.toContain('SVG');
        expect(result).toContain('Text');
    });

    it('does not include head content', function () {
        const result = extractBotview(
            '<html><head><title>Title</title></head><body>Body</body></html>'
        );
        expect(result).not.toContain('Title');
        expect(result).toBe('Body');
    });

    // --- Line break handling ---

    it('converts <br> to newline', function () {
        expect(extractBotview(
            '<html><head></head><body>Line 1<br>Line 2</body></html>'
        )).toBe('Line 1\nLine 2');
    });

    it('converts <br/> to newline', function () {
        expect(extractBotview(
            '<html><head></head><body>A<br/>B</body></html>'
        )).toBe('A\nB');
    });

    it('converts <br /> to newline', function () {
        expect(extractBotview(
            '<html><head></head><body>A<br />B</body></html>'
        )).toBe('A\nB');
    });

    it('converts <br> with attributes to newline', function () {
        expect(extractBotview(
            '<html><head></head><body>A<br class="clear" />B</body></html>'
        )).toBe('A\nB');
    });

    // --- Paragraph / block-level whitespace ---

    it('separates paragraphs with blank lines', function () {
        expect(extractBotview(
            '<html><head></head><body><p>First</p><p>Second</p></body></html>'
        )).toBe('First\n\nSecond');
    });

    it('separates headline from paragraph with blank line', function () {
        const result = extractBotview(
            '<html><head></head><body><h1>Title</h1><p>Text</p></body></html>'
        );
        expect(result).toContain('<h1>Title</h1>');
        expect(result).toContain('Text');
        expect(result).toMatch(/\n\n/);
    });

    it('collapses multiple empty paragraphs to a single blank line', function () {
        expect(extractBotview(
            '<html><head></head><body><p>A</p><p></p><p></p><p>B</p></body></html>'
        )).toBe('A\n\nB');
    });

    it('never produces more than two consecutive newlines', function () {
        const result = extractBotview(
            '<html><head></head><body><p>A</p><p></p><p></p><p></p><p>B</p></body></html>'
        );
        expect(result).not.toMatch(/\n{3,}/);
    });

    // --- Entity decoding ---

    it('decodes HTML entities', function () {
        const result = extractBotview(
            '<html><head></head><body>A &amp; B &ndash; C</body></html>'
        );
        expect(result).toBe('A & B \u2013 C');
    });

    it('decodes numeric entities', function () {
        const result = extractBotview(
            '<html><head></head><body>&#169; 2024</body></html>'
        );
        expect(result).toBe('\u00A9 2024');
    });

    // --- Whitespace normalization ---

    it('collapses multiple spaces to a single space', function () {
        expect(extractBotview(
            '<html><head></head><body>A     B     C</body></html>'
        )).toBe('A B C');
    });

    it('trims leading and trailing whitespace', function () {
        expect(extractBotview(
            '<html><head></head><body>  \n  Hello  \n  </body></html>'
        )).toBe('Hello');
    });

    // --- Edge cases ---

    it('handles empty body', function () {
        expect(extractBotview(
            '<html><head></head><body></body></html>'
        )).toBe('');
    });

    it('handles empty input', function () {
        expect(extractBotview('')).toBe('');
    });

    it('handles HTML without body tag', function () {
        const result = extractBotview('<h1>No body tag</h1>');
        expect(result).toContain('<h1>');
        expect(result).toContain('No body tag');
    });

    it('handles a fragment with no html, head, or body tags', function () {
        expect(extractBotview('<p>Fragment only</p>')).toBe('Fragment only');
    });

    it('handles <body> without <html> wrapper', function () {
        expect(extractBotview('<body><p>In body only</p></body>')).toBe('In body only');
    });

    it('handles <html> with <body> but no <head>', function () {
        expect(extractBotview('<html><body><p>Has body</p></body></html>')).toBe('Has body');
    });

    it('includes stripped head text when <html> has no <body> (full string is processed)', function () {
        const html = '<html><head><title>Head title</title></head><p>Direct under html</p></html>';
        expect(extractBotview(html)).toBe('Head title\n\nDirect under html');
    });

    it('handles <!DOCTYPE html> without <html> or <body>', function () {
        expect(extractBotview('<!DOCTYPE html><p>After doctype</p>')).toBe('After doctype');
    });

    // --- Complex / integration ---

    it('processes a realistic page with all element types', function () {
        const result = extractBotview(BV_COMPLEX);

        expect(result).toContain('<h1>');
        expect(result).toContain('<strong>Title</strong>');
        expect(result).toContain('</h1>');
        expect(result).toContain('First paragraph.');
        expect(result).toContain('<img alt="A nice photo" />');
        expect(result).toContain('<h2>Subtitle</h2>');
        expect(result).toContain('Second paragraph with & entity.');
        expect(result).toContain('<h3>Third level</h3>');

        expect(result).not.toContain('do not extract');
        expect(result).not.toContain('color: red');
        expect(result).not.toContain('noscript');
        expect(result).not.toContain('comment');
        expect(result).not.toContain('svg text');
        expect(result).not.toContain('&amp;');
        expect(result).not.toContain('class="small"');
    });

    it('produces consistent output for list items', function () {
        const result = extractBotview(
            '<html><head></head><body><ul><li>One</li><li>Two</li><li>Three</li></ul></body></html>'
        );
        expect(result).toContain('<li>One</li>');
        expect(result).toContain('<li>Two</li>');
        expect(result).toContain('<li>Three</li>');
    });

    it('is idempotent on its own output (no further stripping)', function () {
        const first = extractBotview(BV_COMPLEX);
        const wrapped = '<html><head></head><body>' + first + '</body></html>';
        const second = extractBotview(wrapped);
        expect(second.replace(/\s+/g, ' ').trim()).toBe(first.replace(/\s+/g, ' ').trim());
    });
});


// ---------------------------------------------------------------------------
// parseSnapshot (integration)
// ---------------------------------------------------------------------------

describe('parseSnapshot', function () {
    it('extracts all fields from a minimal page', function () {
        const result = parseSnapshot(MINIMAL_PAGE);
        expect(result.title).toBe('Hello World');
        expect(result.meta_description).toBe('A simple page');
        expect(result.plaintext).toBe('Content here');
        expect(result.botview).toBe('Content here');
        expect(JSON.parse(result.headlines_json)).toEqual([]);
        expect(JSON.parse(result.classes_ids_json)).toEqual([]);
    });

    it('extracts all fields from unquoted-attrs page', function () {
        const result = parseSnapshot(UNQUOTED_ATTRS_PAGE);
        expect(result.title).toBe('SEO Agentur KOCH ESSEN \u2022 Full-Service und SEO Beratung');
        expect(result.meta_description).toBe('Zuverlässige SEO-Agentur in Essen');
        expect(result.plaintext).toContain('Willkommen');
        expect(result.plaintext).toContain('Text');
        const headlines = JSON.parse(result.headlines_json);
        expect(headlines).toHaveLength(1);
        expect(headlines[0]).toEqual({ level: 1, text: 'Willkommen' });
    });

    it('extracts all fields from complex body', function () {
        const result = parseSnapshot(COMPLEX_BODY);
        expect(result.title).toBe('Test');
        expect(result.plaintext).toContain('First paragraph');
        expect(result.plaintext).toContain('A nice photo');
        expect(result.plaintext).toContain('Second paragraph with & entity.');
        expect(result.plaintext).not.toContain('do not extract');
        expect(result.botview).toContain('<h1>');
        expect(result.botview).toContain('<img alt="A nice photo" />');
        expect(result.botview).not.toContain('do not extract');
        const headlines = JSON.parse(result.headlines_json);
        expect(headlines).toHaveLength(3);
        const classesIds = JSON.parse(result.classes_ids_json);
        expect(classesIds).toContain('small');
    });

    it('handles real-world KOCH ESSEN page', function () {
        const result = parseSnapshot(REAL_WORLD_KOCH_HEAD);
        expect(result.title).toBe('SEO Agentur KOCH ESSEN \u2022 Full-Service und SEO Beratung');
        expect(result.meta_description).toContain('Zuverlässige SEO-Agentur in Essen');
        expect(result.meta_description).toContain('Jetzt Anfragen!');
    });
});
