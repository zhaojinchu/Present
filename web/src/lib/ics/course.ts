// Course code and name from a calendar SUMMARY, for any school's naming.

export interface SplitSummary {
  course_code: string;
  name: string | null;
  kind: 'lecture' | 'recitation' | 'lab' | 'seminar' | 'section' | null;
}

const KIND_WORDS: [RegExp, SplitSummary['kind']][] = [
  [/\b(lecture|lec)\b\.?/i, 'lecture'],
  [/\b(recitation|rec|discussion|disc)\b\.?/i, 'recitation'],
  [/\b(lab|laboratory)\b\.?/i, 'lab'],
  [/\b(seminar|sem)\b\.?/i, 'seminar'],
  [/\b(section|sec)\b\.?\s*[A-Z0-9]*/i, 'section'],
];

const CODE_PATTERNS = [
  /\b(\d{2}-\d{3})\b/, // 15-122 (CMU)
  /\b([A-Z]{2,5})[ \-_]?(\d{1,4}[A-Z]{0,2})\b/, // CS 61A, MATH 1A, COMP-110, ECE 101L
  /\b([A-Z]{2,5})\s?(\d{2,4}\.\d{1,3})\b/, // 18.06 style with prefix
  /\b(\d{1,2}\.\d{2,3})\b/, // MIT 6.006
];

export function splitSummary(summary: string): SplitSummary {
  let s = summary.replace(/\s+/g, ' ').trim();
  let kind: SplitSummary['kind'] = null;
  for (const [re, k] of KIND_WORDS) {
    if (re.test(s)) {
      kind = k;
      s = s.replace(re, ' ').replace(/\s+/g, ' ').trim();
      break;
    }
  }
  let code: string | null = null;
  for (const re of CODE_PATTERNS) {
    const m = s.match(re);
    if (m) {
      code = m[0].replace(/[_]/g, ' ').replace(/([A-Z]+)-(\d)/, '$1 $2').trim();
      s = (s.slice(0, m.index) + ' ' + s.slice((m.index ?? 0) + m[0].length)).trim();
      break;
    }
  }
  const name = s.replace(/^[\s:\-–—,|]+|[\s:\-–—,|()]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!code) return { course_code: summary.trim().slice(0, 24) || 'Class', name: null, kind };
  return { course_code: code, name: name || null, kind };
}
