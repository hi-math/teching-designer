'use client';

import { useState, useEffect, useRef } from 'react';

// ─── 타입 ──────────────────────────────────────────────────────────

interface Standard {
  code: string;
  subject_group: string;
  subject: string;
  grade_group: string;
  school_level: string;
  domain: string;
  content: string;
  keywords: string[];
  explanation: string;
}

interface Meta {
  subjects: string[];
  domains: string[];
}

// ─── 서브 컴포넌트: 드롭다운 ────────────────────────────────────

function Select({
  label, value, options, placeholder, onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-[130px]">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-[#9AAAC0]">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[#D8E2F0] bg-white px-3 py-2 text-[14px] text-[#2C3A52] outline-none focus:border-[#534AB7] focus:ring-1 focus:ring-[#534AB7]/20"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

// ─── 서브 컴포넌트: 결과 카드 ───────────────────────────────────

function StandardCard({ standard }: { standard: Standard }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-[#E4EBF5] bg-white p-4 shadow-sm transition hover:border-[#B8C8E8]">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-[#534AB7] px-2 py-0.5 text-[12px] font-bold text-white">
            {standard.code}
          </span>
          <span className="text-[13px] text-[#9AAAC0]">
            {standard.subject}
          </span>
          <span className="text-[13px] text-[#9AAAC0]">·</span>
          <span className="text-[13px] text-[#9AAAC0]">
            {standard.grade_group}
          </span>
          {standard.domain && (
            <>
              <span className="text-[13px] text-[#9AAAC0]">·</span>
              <span className="rounded-full bg-[#F2F5FA] px-2 py-0.5 text-[12px] text-[#6B7A99]">
                {standard.domain}
              </span>
            </>
          )}
        </div>
      </div>

      <p className="text-[14px] leading-relaxed text-[#2C3A52]">
        {standard.content}
      </p>

      {standard.keywords.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {standard.keywords.map((kw) => (
            <span key={kw} className="rounded-full bg-[#EEF2F8] px-2 py-0.5 text-[11px] text-[#6B7A99]">
              {kw}
            </span>
          ))}
        </div>
      )}

      {standard.explanation && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 text-[12px] text-[#534AB7] hover:underline"
          >
            {expanded ? '해설 접기 ▲' : '해설 보기 ▼'}
          </button>
          {expanded && (
            <p className="mt-2 text-[13px] leading-relaxed text-[#6B7A99] border-t border-[#F2F5FA] pt-2">
              {standard.explanation}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────

export default function StandardsModal({ onClose }: { onClose: () => void }) {
  const [meta, setMeta] = useState<Meta>({ subjects: [], domains: [] });
  const [subject, setSubject] = useState('');
  const [domain, setDomain]   = useState('');
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<Standard[]>([]);
  const [total, setTotal]     = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Escape 닫기
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  // 초기 meta 로드
  useEffect(() => {
    fetch('/api/standards?type=meta')
      .then((r) => r.json())
      .then((data) => setMeta(data));
    inputRef.current?.focus();
  }, []);

  // 교과 변경 → 영역 목록 갱신
  useEffect(() => {
    const params = new URLSearchParams({ type: 'meta' });
    if (subject) params.set('subject', subject);
    fetch(`/api/standards?${params}`)
      .then((r) => r.json())
      .then((data) => setMeta((prev) => ({ ...prev, domains: data.domains })));
    setDomain('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  // 검색 실행
  const search = async () => {
    if (!subject && !domain && !query.trim()) return;
    setLoading(true);
    setSearched(true);
    const params = new URLSearchParams({ limit: '50' });
    if (subject)       params.set('subject', subject);
    if (domain)        params.set('domain',  domain);
    if (query.trim())  params.set('q',       query.trim());
    const res = await fetch(`/api/standards?${params}`);
    const data: Standard[] = await res.json();
    setResults(data);
    setTotal(data.length);
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') search();
  };

  const handleReset = () => {
    setSubject(''); setDomain(''); setQuery('');
    setResults([]); setSearched(false); setTotal(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex flex-col bg-[#F7F9FD] rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: '80vw', height: '80vh' }}
      >
        {/* ── 헤더 ── */}
        <div className="shrink-0 flex items-center justify-between border-b border-[#E4EBF5] bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#534AB7] text-white">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-[17px] font-semibold text-[#1C2B3A]">성취기준 검색</h2>
            <span className="text-[12px] text-[#9AAAC0]">2022 개정 교육과정 · 중학교</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9AAAC0] transition hover:bg-[#F2F5FA] hover:text-[#3A4560]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── 필터 + 검색 ── */}
        <div className="shrink-0 border-b border-[#E4EBF5] bg-white px-6 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label="교과"
              value={subject}
              options={meta.subjects}
              placeholder="전체"
              onChange={setSubject}
            />
            <Select
              label="영역"
              value={domain}
              options={meta.domains}
              placeholder="전체"
              onChange={setDomain}
            />

            {/* 검색창 */}
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-[#9AAAC0]">
                키워드 검색
              </label>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="성취기준 코드, 키워드, 내용 검색..."
                className="rounded-lg border border-[#D8E2F0] bg-white px-3 py-2 text-[14px] text-[#2C3A52] placeholder-[#9AAAC0] outline-none focus:border-[#534AB7] focus:ring-1 focus:ring-[#534AB7]/20"
              />
            </div>

            {/* 검색 버튼 */}
            <button
              onClick={search}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-[#534AB7] px-5 py-2 text-[14px] font-medium text-white transition hover:bg-[#4338A0] disabled:opacity-50"
              style={{ marginBottom: 0, alignSelf: 'flex-end' }}
            >
              {loading ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
              검색
            </button>

            {searched && (
              <button
                onClick={handleReset}
                className="rounded-lg border border-[#D8E2F0] bg-white px-4 py-2 text-[14px] text-[#6B7A99] transition hover:bg-[#F2F5FA]"
                style={{ alignSelf: 'flex-end' }}
              >
                초기화
              </button>
            )}
          </div>
        </div>

        {/* ── 결과 ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!searched && !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EEF2F8] text-[#9AAAC0]">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-[15px] font-medium text-[#6B7A99]">교과·영역을 선택하거나 키워드를 입력하고 검색하세요.</p>
              <p className="text-[13px] text-[#9AAAC0]">2022 개정 교육과정 중학교 성취기준 655개 수록</p>
            </div>
          )}

          {searched && !loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
              <p className="text-[15px] text-[#6B7A99]">검색 결과가 없습니다.</p>
              <p className="text-[13px] text-[#9AAAC0]">다른 키워드나 필터를 시도해보세요.</p>
            </div>
          )}

          {searched && !loading && results.length > 0 && (
            <>
              <p className="mb-4 text-[13px] text-[#9AAAC0]">
                검색 결과 <span className="font-semibold text-[#534AB7]">{total}</span>개
                {total === 50 && ' (최대 50개 표시)'}
              </p>
              <div className="flex flex-col gap-3">
                {results.map((std) => (
                  <StandardCard key={std.code} standard={std} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
