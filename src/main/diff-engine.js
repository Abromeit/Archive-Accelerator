import { diffWords } from 'diff';

export function textDiffPercentage(a, b) {
    if (a === b) return 0;
    if (!a && !b) return 0;
    if (!a || !b) return 100;

    const changes = diffWords(a, b);
    let totalChars = 0;
    let changedChars = 0;

    for (let i = 0, i_max = changes.length; i < i_max; ++i) {
        const part = changes[i];
        const len = part.value.length;
        totalChars += len;
        if (part.added || part.removed) {
            changedChars += len;
        }
    }

    if (totalChars === 0) return 0;
    return Math.round((changedChars / totalChars) * 100 * 10) / 10;
}


export function templateDiffPercentage(classesIdsA, classesIdsB) {
    const setA = new Set(classesIdsA);
    const setB = new Set(classesIdsB);

    const union = new Set([...setA, ...setB]);
    if (union.size === 0) return 0;

    let symmetricDiff = 0;
    for (const item of union) {
        if (!setA.has(item) || !setB.has(item)) {
            ++symmetricDiff;
        }
    }

    return Math.round((symmetricDiff / union.size) * 100 * 10) / 10;
}


export function headlinesChanged(headlinesJsonA, headlinesJsonB) {
    return headlinesJsonA !== headlinesJsonB;
}


export function titleChanged(titleA, titleB) {
    return (titleA || '') !== (titleB || '');
}


export function metaDiffPercentage(titleA, descA, titleB, descB) {
    const titlePct = textDiffPercentage(titleA || '', titleB || '');
    const descPct = textDiffPercentage(descA || '', descB || '');
    return Math.round((titlePct * 0.5 + descPct * 0.5) * 10) / 10;
}


export function computeAllDiffs(current, previous) {
    const classesIdsA = safeParseJson(current.classes_ids_json, []);
    const classesIdsB = safeParseJson(previous.classes_ids_json, []);

    return {
        template_pct: templateDiffPercentage(classesIdsA, classesIdsB),
        text_pct: textDiffPercentage(current.plaintext || '', previous.plaintext || ''),
        headlines_changed: headlinesChanged(current.headlines_json, previous.headlines_json) ? 1 : 0,
        meta_pct: metaDiffPercentage(current.title, current.meta_description, previous.title, previous.meta_description),
        title_changed: titleChanged(current.title, previous.title) ? 1 : 0,
    };
}


export function computeDisplayPercentage(diff, filter) {
    switch (filter) {
        case 'template':
            return diff.template_pct;
        case 'text':
            return diff.text_pct;
        case 'headlines':
            return diff.text_pct;
        case 'meta':
            return diff.meta_pct;
        case 'title':
            return metaDiffPercentage(diff.title_a, '', diff.title_b, '');
        default:
            return Math.round(
                ((diff.template_pct + diff.text_pct + diff.meta_pct) / 3) * 10
            ) / 10;
    }
}


function safeParseJson(str, fallback) {
    if (!str) return fallback;
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}
