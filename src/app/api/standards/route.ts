import { type NextRequest } from 'next/server';
import { getStandards, scoreStandard } from '@/lib/standards';

// ─── 필터 옵션 반환 ──────────────────────────────────────────────

function handleMeta(params: URLSearchParams) {
  const standards = getStandards();
  const subject = params.get('subject') ?? '';

  const filtered = standards
    .filter((s) => !subject || s.subject_group === subject || s.subject === subject);

  // 교과: 첫 등장 order 기준 정렬
  const subjectOrderMap = new Map<string, number>();
  for (const s of standards) {
    if (s.subject_group && !subjectOrderMap.has(s.subject_group)) {
      subjectOrderMap.set(s.subject_group, s.order);
    }
  }
  const subjects = [...subjectOrderMap.keys()].sort(
    (a, b) => (subjectOrderMap.get(a) ?? 0) - (subjectOrderMap.get(b) ?? 0)
  );

  // 영역: 필터된 결과에서 첫 등장 순서 유지 (배열 순)
  const seen = new Set<string>();
  const domains: string[] = [];
  for (const s of filtered) {
    if (s.domain && !seen.has(s.domain)) {
      seen.add(s.domain);
      domains.push(s.domain);
    }
  }

  return Response.json({ subjects, domains });
}

// ─── 성취기준 검색 ────────────────────────────────────────────────

function handleSearch(params: URLSearchParams) {
  const subject = params.get('subject') ?? '';
  const domain  = params.get('domain')  ?? '';
  const query   = params.get('q')       ?? '';
  const limit   = Math.min(Number(params.get('limit') ?? '30'), 100);

  const standards = getStandards();

  let results = standards
    .filter((s) => !subject || s.subject_group === subject || s.subject === subject)
    .filter((s) => !domain  || s.domain        === domain);

  if (query.trim()) {
    const terms = query.trim().split(/\s+/).filter((t) => t.length >= 2);
    results = results
      .map((s) => ({ s, score: scoreStandard(s, query, terms) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.s);
  } else {
    results = results.sort((a, b) => a.order - b.order);
  }

  return Response.json(results.slice(0, limit));
}

// ─── 라우트 핸들러 ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  if (searchParams.get('type') === 'meta') return handleMeta(searchParams);
  return handleSearch(searchParams);
}
