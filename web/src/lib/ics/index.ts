export { splitSummary } from './course';
export { durationMinutes, parseDateTime, parseIcs, parseRRule, tokenize, unescapeText, type IcsCalendar, type IcsDateTime, type IcsEvent, type RRule } from './parse';
export { mergeSiblings, toClassDrafts, toImportRows, type ClassDraft, type DraftResult, type Skipped } from './toClasses';
export { dateInTz, isValidTz, resolveTzid, toLocal } from './tz';

/** Looks like a calendar file rather than a link. */
export function looksLikeIcs(text: string): boolean {
  return /BEGIN:VCALENDAR/i.test(text.slice(0, 2000));
}

/** Looks like a calendar link (https or webcal). */
export function looksLikeUrl(text: string): boolean {
  return /^(https?|webcal):\/\/\S+$/i.test(text.trim());
}
