import { type NextRequest } from 'next/server';
import { getStandards, scoreStandard } from '@/lib/standards';

// ─── 필터 옵션 반환 ──────────────────────────────────────────────

function handleMeta(params: URLSearchParams) {
  const standards = getStandards();
  const subject = params.get('subject') ?? '';

  const filtered = standards
    .filter((s) => !subject || s.subject_group === subject || s.subject === subject);

  const subjects = [...new Set(standards.map((s) => s.subject_group).filter(Boolean))].sort();
  const domains  = [...new Set(filtered.map((s) => s.domain).filter(Boolean))].sort();

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
    results = results.slice(0, limit);
  }

  return Response.json(results.slice(0, limit));
}

// ─── 라우트 핸들러 ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  if (searchParams.get('type') === 'meta') return handleMeta(searchParams);
  return handleSearch(searchParams);
}
