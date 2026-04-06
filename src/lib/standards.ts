import fs from 'fs';
import path from 'path';

// ─── 타입 ──────────────────────────────────────────────────────────

export interface Standard {
  code: string;
  subject_group: string;
  subject: string;
  grade_group: string;
  school_level: string;
  curriculum_category: string;
  domain: string;
  content: string;
  keywords: string[];
  explanation: string;
  application_notes: string;
}

// ─── 캐시 ──────────────────────────────────────────────────────────

let _cache: Standard[] | null = null;

export function getStandards(): Standard[] {
  if (_cache) return _cache;
  const filePath = path.join(process.cwd(), 'public', 'standard', 'standards_middle.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const db = JSON.parse(raw) as { standards: Standard[] };
  _cache = db.standards;
  return _cache;
}

// ─── 트리거 감지 ────────────────────────────────────────────────────

const TRIGGERS = [
  '성취기준', '성취 기준', '교육과정', '학습목표', '학습 목표',
  '내용체계', '핵심개념', '핵심 아이디어', '교과서', '단원',
  '영역', '교과', '수업목표', '수업 목표',
];

const SUBJECTS = [
  '국어', '수학', '영어', '과학', '사회', '도덕', '체육', '음악', '미술',
  '기술', '가정', '정보', '역사', '지리', '물리', '화학', '생명과학',
  '지구과학', '경제', '정치', '법', '사회문화', '한국사', '세계사',
];

export function isStandardsQuery(text: string): boolean {
  if (TRIGGERS.some((t) => text.includes(t))) return true;
  // 코드 패턴: [숫자 또는 한글 포함 대괄호]
  if (/\[\d/.test(text)) return true;
  return false;
}

// ─── 검색 ──────────────────────────────────────────────────────────

export function scoreStandard(s: Standard, query: string, terms: string[]): number {
  let score = 0;

  // 정확한 코드 매칭 (최고 우선순위)
  if (query.includes(s.code)) return 1000;

  // 교과 매칭
  if (query.includes(s.subject_group)) score += 40;
  if (query.includes(s.subject))       score += 25;

  // 학교급 / 학년군
  if (s.school_level && query.includes(s.school_level)) score += 15;
  if (s.grade_group  && query.includes(s.grade_group))  score += 15;

  // 영역 매칭
  if (s.domain) {
    if (query.includes(s.domain)) score += 20;
    if (terms.some((t) => t.length >= 2 && s.domain.includes(t))) score += 10;
  }

  // 키워드 매칭
  for (const kw of s.keywords) {
    if (kw.length < 2) continue;
    if (query.includes(kw)) score += 8;
    else if (terms.some((t) => t.length >= 2 && (kw.includes(t) || t.includes(kw)))) score += 4;
  }

  // 내용 매칭
  for (const term of terms) {
    if (term.length >= 2 && s.content.includes(term)) score += 3;
  }

  return score;
}

export function searchStandards(query: string, limit = 8): Standard[] {
  const standards = getStandards();

  // 교과 필터로 후보 사전 축소
  const subjectFilter = SUBJECTS.find((sub) => query.includes(sub));
  const candidates = subjectFilter
    ? standards.filter((s) => s.subject_group === subjectFilter || s.subject_group.includes(subjectFilter))
    : standards;

  // 쿼리에서 의미 있는 단어 추출 (2자 이상)
  const terms = query
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 20);

  const scored = candidates
    .map((s) => ({ s, score: scoreStandard(s, query, terms) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((x) => x.s);
}

// ─── 컨텍스트 포맷 ─────────────────────────────────────────────────

export function formatStandardsContext(standards: Standard[]): string {
  if (standards.length === 0) return '';

  const lines: string[] = [
    '---',
    '## 검색된 성취기준 (2022 개정 교육과정)',
    '아래 성취기준을 참고하여 답변하세요.',
    '',
  ];

  for (const s of standards) {
    lines.push(`**${s.code}** — ${s.subject} (${s.school_level} / ${s.grade_group})`);
    if (s.area) lines.push(`영역: ${s.area}`);
    lines.push(`내용: ${s.content}`);
    if (s.keywords.length > 0) lines.push(`키워드: ${s.keywords.join(', ')}`);
    if (s.explanation) lines.push(`해설: ${s.explanation.slice(0, 200)}${s.explanation.length > 200 ? '…' : ''}`);
    lines.push('');
  }

  lines.push('---');
  return lines.join('\n');
}
