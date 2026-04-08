import { createClient } from "@supabase/supabase-js";
import chromium from "@sparticuz/chromium-min";
import { chromium as playwrightChromium } from "playwright-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─── Supabase (service role — bypasses RLS) ──────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Chromium 실행 ───────────────────────────────────────────────
async function launchBrowser() {
  if (process.env.NODE_ENV === "development") {
    return playwrightChromium.launch({ headless: true });
  }
  const executablePath = await chromium.executablePath(process.env.CHROMIUM_PACK_URL!);
  return playwrightChromium.launch({ args: chromium.args, executablePath, headless: true });
}

// ─── 데이터 타입 ─────────────────────────────────────────────────
type ActivityContent = { type?: string; text?: string; status?: string; rows?: { name: string; role: string }[]; items?: unknown[]; question?: string; active?: boolean; response?: string };

const PHASES = [
  { code: "T",  label: "팀 준비",   english: "PHASE 01 — Team Prep" },
  { code: "A",  label: "분석",      english: "PHASE 02 — Analysis" },
  { code: "Ds", label: "설계",      english: "PHASE 03 — Design" },
  { code: "DI", label: "개발/실행", english: "PHASE 04 — Development" },
  { code: "E",  label: "평가/성찰", english: "PHASE 05 — Evaluation" },
];

const PHASE_SECTIONS: Record<string, { code: string; label: string; activities: { code: string; label: string }[] }[]> = {
  T: [
    { code: "T-1", label: "비전 설정", activities: [{ code: "T-1-1", label: "비전 설정" }, { code: "T-1-2", label: "수업설계 방향 수립" }] },
    { code: "T-2", label: "역할 분담", activities: [{ code: "T-2-1", label: "역할 분담" }, { code: "T-2-2", label: "팀 규칙" }, { code: "T-2-3", label: "팀 일정" }, { code: "학습자 분석", label: "학습자 분석" }] },
  ],
  A: [
    { code: "A-1", label: "주제 선정", activities: [{ code: "A-1-1", label: "주제 선정 기준" }, { code: "A-1-2", label: "주제 선정" }] },
    { code: "A-2", label: "핵심 아이디어 분석", activities: [{ code: "A-2-1", label: "핵심 아이디어 및 성취 기준 분석" }, { code: "A-2-2", label: "통합된 수업 목표" }] },
  ],
  Ds: [
    { code: "Ds-1", label: "평가 및 문제 설계", activities: [{ code: "Ds-1-1", label: "평가 계획" }, { code: "Ds-1-2", label: "문제 상황" }, { code: "Ds-1-3", label: "학습 활동 설계" }] },
    { code: "Ds-2", label: "지원 도구 설계", activities: [{ code: "Ds-2-1", label: "지원 도구 설계" }, { code: "Ds-2-2", label: "스캐폴딩 설계" }] },
  ],
  DI: [
    { code: "DI-1", label: "개발 및 프로토타이핑", activities: [{ code: "DI-1-1", label: "개발 자료 목록" }, { code: "DI-AI", label: "AI 자료 프로토타이핑" }, { code: "DI-SIM", label: "수업 시뮬레이션" }] },
    { code: "DI-2", label: "수업 기록", activities: [{ code: "DI-2-1", label: "수업 기록" }] },
  ],
  E: [
    { code: "E-1", label: "수업 성찰", activities: [{ code: "E-1-1", label: "수업 성찰" }] },
    { code: "E-2", label: "수업설계 과정 성찰", activities: [{ code: "E-2-1", label: "수업설계 과정 성찰" }] },
  ],
};

// ─── HTML 이스케이프 ─────────────────────────────────────────────
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function nl2br(s: string) {
  return esc(s).replace(/\n/g, "<br>");
}

// ─── HTML 생성 ───────────────────────────────────────────────────
function buildHtml(data: {
  title: string;
  targetGrade: string | null;
  relatedSubjects: string | null;
  numClasses: number | null;
  numStudents: number | null;
  totalSessions: number | null;
  members: { name: string; email: string }[];
  contents: Record<string, ActivityContent>;
  standards: { code: string; subject: string; domain: string; content: string }[];
  ideas: { subject: string; domain: string; content: string }[];
  opinions: { question: string; responses: { name: string; response: string }[] }[];
  generatedAt: string;
}): string {
  const infoChips = [
    data.targetGrade && `대상: ${data.targetGrade}`,
    data.relatedSubjects && `과목: ${data.relatedSubjects}`,
    data.numClasses && `${data.numClasses}학급`,
    data.numStudents && `${data.numStudents}명`,
    data.totalSessions && `${data.totalSessions}차시`,
  ].filter(Boolean);

  // ── 성취기준 섹션
  const standardsHtml = data.standards.length > 0 ? `
    <div class="section">
      <div class="section-header">
        <span class="section-badge">성취기준</span>
      </div>
      <div class="standards-grid">
        ${data.standards.map(s => `
          <div class="standard-item">
            <span class="std-code">${esc(s.code)}</span>
            <span class="std-subject">${esc(s.subject)} · ${esc(s.domain)}</span>
            <p class="std-content">${esc(s.content)}</p>
          </div>
        `).join("")}
      </div>
    </div>` : "";

  // ── 핵심아이디어 섹션
  const ideasHtml = data.ideas.length > 0 ? `
    <div class="section">
      <div class="section-header">
        <span class="section-badge">핵심아이디어</span>
      </div>
      ${data.ideas.map(i => `
        <div class="idea-item">
          <span class="idea-tag">${esc(i.subject)} · ${esc(i.domain)}</span>
          <p class="idea-content">${esc(i.content)}</p>
        </div>
      `).join("")}
    </div>` : "";

  // ── 의견묻기 섹션
  const opinionsHtml = data.opinions.length > 0 ? `
    <div class="section">
      <div class="section-header">
        <span class="section-badge opinion-badge">의견묻기</span>
      </div>
      ${data.opinions.map(o => `
        <div class="opinion-block">
          <p class="opinion-q">${esc(o.question)}</p>
          ${o.responses.length > 0 ? `<div class="opinion-responses">
            ${o.responses.map(r => `<div class="opinion-res"><span class="res-name">${esc(r.name)}</span><span class="res-text">${esc(r.response)}</span></div>`).join("")}
          </div>` : ""}
        </div>
      `).join("")}
    </div>` : "";

  // ── 단계별 섹션
  const phasesHtml = PHASES.map(phase => {
    const sections = PHASE_SECTIONS[phase.code] ?? [];
    const hasContent = sections.some(sec =>
      sec.activities.some(act => {
        const c = data.contents[act.code];
        return c && ((c.text && c.text.trim()) || (c.rows && c.rows.length > 0));
      })
    );
    if (!hasContent) return "";

    return `
      <div class="phase-block">
        <div class="phase-header">
          <span class="phase-english">${esc(phase.english)}</span>
          <h2 class="phase-label">${esc(phase.label)}</h2>
        </div>
        ${sections.map(sec => {
          const actHtml = sec.activities.map(act => {
            const c = data.contents[act.code];
            const status = c?.status;
            if (!c || ((!c.text || !c.text.trim()) && (!c.rows || c.rows.length === 0))) return "";

            const statusBadge = status === "completed"
              ? `<span class="status-badge completed">완료</span>`
              : status === "skipped"
              ? `<span class="status-badge skipped">건너뜀</span>`
              : "";

            const bodyHtml = act.code === "T-2-1" && c.rows
              ? `<table class="role-table">
                  <thead><tr><th>이름</th><th>역할</th></tr></thead>
                  <tbody>${c.rows.map(r => `<tr><td>${esc(r.name)}</td><td>${esc(r.role)}</td></tr>`).join("")}</tbody>
                </table>`
              : `<p class="activity-text">${nl2br(c.text ?? "")}</p>`;

            return `
              <div class="activity-item">
                <div class="activity-header">
                  <span class="act-code">${esc(act.code)}</span>
                  <span class="act-label">${esc(act.label)}</span>
                  ${statusBadge}
                </div>
                ${bodyHtml}
              </div>`;
          }).join("");

          if (!actHtml.trim()) return "";
          return `
            <div class="section-block">
              <h3 class="section-label">${esc(sec.label)}</h3>
              ${actHtml}
            </div>`;
        }).join("")}
      </div>`;
  }).join("");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${esc(data.title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;900&display=swap');

    @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: 'Noto Sans KR', -apple-system, sans-serif;
      font-size: 10pt;
      color: #1f2937;
      line-height: 1.65;
    }

    /* ── 커버 ── */
    .cover {
      padding: 10mm 0 8mm;
      border-bottom: 3px solid #5044e3;
      margin-bottom: 8mm;
    }
    .cover-label {
      font-size: 8pt;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #5044e3;
      margin-bottom: 3mm;
    }
    .cover-title {
      font-size: 22pt;
      font-weight: 900;
      color: #111827;
      line-height: 1.2;
      margin: 0 0 5mm;
    }
    .cover-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 2mm;
      margin-bottom: 5mm;
    }
    .chip {
      background: #f0f0ff;
      color: #5044e3;
      border: 1px solid #d5cef8;
      border-radius: 999px;
      padding: 1.5mm 4mm;
      font-size: 8.5pt;
      font-weight: 500;
    }
    .cover-meta {
      font-size: 8.5pt;
      color: #6b7280;
      display: flex;
      gap: 5mm;
      flex-wrap: wrap;
    }
    .members-list { color: #374151; font-weight: 500; }

    /* ── 공통 섹션 ── */
    .section {
      margin-bottom: 7mm;
      break-inside: avoid;
    }
    .section-header {
      margin-bottom: 2.5mm;
    }
    .section-badge {
      display: inline-block;
      background: #5044e3;
      color: white;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.08em;
      padding: 1mm 3mm;
      border-radius: 4px;
    }
    .opinion-badge { background: #44c4b8; }

    /* ── 성취기준 ── */
    .standards-grid { display: flex; flex-direction: column; gap: 2mm; }
    .standard-item {
      border-left: 3px solid #5044e3;
      padding: 2mm 3mm;
      background: #f8f7ff;
      border-radius: 0 4px 4px 0;
    }
    .std-code { font-size: 7.5pt; font-weight: 700; color: #5044e3; margin-right: 2mm; }
    .std-subject { font-size: 7.5pt; color: #6b7280; }
    .std-content { margin: 1mm 0 0; font-size: 9pt; color: #374151; }

    /* ── 핵심아이디어 ── */
    .idea-item {
      padding: 2mm 3mm;
      background: #f0fdfb;
      border-left: 3px solid #44c4b8;
      border-radius: 0 4px 4px 0;
      margin-bottom: 1.5mm;
    }
    .idea-tag { font-size: 7.5pt; font-weight: 600; color: #35afa3; }
    .idea-content { margin: 1mm 0 0; font-size: 9pt; color: #374151; }

    /* ── 의견묻기 ── */
    .opinion-block {
      background: #f0fdfb;
      border: 1px solid #abe9e3;
      border-radius: 6px;
      padding: 3mm 4mm;
      margin-bottom: 2mm;
      break-inside: avoid;
    }
    .opinion-q { font-weight: 600; font-size: 9.5pt; color: #1f2937; margin: 0 0 2mm; }
    .opinion-responses { display: flex; flex-direction: column; gap: 1mm; }
    .opinion-res { display: flex; gap: 2mm; align-items: baseline; }
    .res-name { font-size: 8pt; font-weight: 600; color: #35afa3; min-width: 15mm; }
    .res-text { font-size: 8.5pt; color: #374151; }

    /* ── 단계 ── */
    .phase-block {
      margin-bottom: 10mm;
      break-before: auto;
    }
    .phase-header {
      background: #5044e3;
      color: white;
      padding: 3mm 5mm;
      border-radius: 6px;
      margin-bottom: 4mm;
      display: flex;
      align-items: center;
      gap: 4mm;
    }
    .phase-english { font-size: 7.5pt; font-weight: 600; letter-spacing: 0.1em; opacity: 0.8; }
    .phase-label { font-size: 13pt; font-weight: 700; margin: 0; }

    .section-block { margin-bottom: 5mm; }
    .section-label {
      font-size: 9.5pt;
      font-weight: 700;
      color: #5044e3;
      border-bottom: 1px solid #d5cef8;
      padding-bottom: 1.5mm;
      margin: 0 0 3mm;
    }

    .activity-item {
      margin-bottom: 3mm;
      break-inside: avoid;
    }
    .activity-header {
      display: flex;
      align-items: center;
      gap: 2mm;
      margin-bottom: 1.5mm;
    }
    .act-code {
      font-size: 7pt;
      font-weight: 700;
      color: #9ca3af;
      letter-spacing: 0.05em;
    }
    .act-label {
      font-size: 9pt;
      font-weight: 600;
      color: #374151;
    }
    .status-badge {
      font-size: 7pt;
      font-weight: 600;
      padding: 0.5mm 2mm;
      border-radius: 999px;
    }
    .status-badge.completed { background: #dbeafe; color: #1d4ed8; }
    .status-badge.skipped   { background: #f3f4f6; color: #6b7280; }

    .activity-text {
      margin: 0;
      font-size: 9.5pt;
      color: #374151;
      white-space: pre-wrap;
      background: #f9fafb;
      border-left: 2px solid #e5e7eb;
      padding: 2mm 3mm;
      border-radius: 0 4px 4px 0;
    }

    /* ── 역할 분담 표 ── */
    .role-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }
    .role-table th {
      background: #ede9fb;
      color: #5044e3;
      font-weight: 600;
      padding: 2mm 3mm;
      text-align: left;
      border: 1px solid #d5cef8;
    }
    .role-table td {
      padding: 1.5mm 3mm;
      border: 1px solid #e5e7eb;
    }
    .role-table tr:nth-child(even) td { background: #f9fafb; }

    /* ── 푸터 ── */
    .footer {
      margin-top: 10mm;
      padding-top: 3mm;
      border-top: 1px solid #e5e7eb;
      font-size: 7.5pt;
      color: #9ca3af;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <!-- 커버 -->
  <div class="cover">
    <div class="cover-label">Minerva · 협력적 수업설계 보고서</div>
    <h1 class="cover-title">${esc(data.title)}</h1>
    ${infoChips.length > 0 ? `<div class="cover-chips">${infoChips.map(c => `<span class="chip">${esc(c as string)}</span>`).join("")}</div>` : ""}
    <div class="cover-meta">
      <span>팀원: <span class="members-list">${data.members.map(m => esc(m.name)).join(", ")}</span></span>
      <span>생성: ${esc(data.generatedAt)}</span>
    </div>
  </div>

  ${standardsHtml}
  ${ideasHtml}
  ${opinionsHtml}
  ${phasesHtml}

  <div class="footer">
    <span>Minerva · 협력적 수업설계</span>
    <span>${esc(data.generatedAt)}</span>
  </div>
</body>
</html>`;
}

// ─── GET /api/pdf?lessonId=xxx ───────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lessonId = searchParams.get("lessonId");
  if (!lessonId) return Response.json({ error: "lessonId required" }, { status: 400 });

  try {
    // 1) 레슨 기본 정보
    const { data: lesson, error: lessonErr } = await supabase
      .from("lessons")
      .select("title, target_grade, related_subjects, num_classes, num_students, total_sessions")
      .eq("id", lessonId)
      .single();
    if (lessonErr || !lesson) return Response.json({ error: "lesson not found" }, { status: 404 });

    // 2) 멤버 목록
    const { data: memberRows } = await supabase
      .from("lesson_members")
      .select("user_id")
      .eq("lesson_id", lessonId);
    const memberIds = (memberRows ?? []).map((r: { user_id: string }) => r.user_id);
    const { data: profiles } = memberIds.length > 0
      ? await supabase.from("profiles").select("id, display_name, email").in("id", memberIds)
      : { data: [] };
    const members = (profiles ?? []).map((p: { id: string; display_name: string | null; email: string | null }) => ({
      name: p.display_name ?? p.email ?? "알 수 없음",
      email: p.email ?? "",
    }));

    // 3) 활동 콘텐츠
    const { data: contentRows } = await supabase
      .from("activity_contents")
      .select("activity_code, content")
      .eq("lesson_id", lessonId);

    const contents: Record<string, ActivityContent> = {};
    let standards: { code: string; subject: string; domain: string; content: string }[] = [];
    let ideas: { subject: string; domain: string; content: string }[] = [];
    const opinionsMap: Record<string, { question: string; responses: { userId: string; response: string }[] }> = {};
    const opinionResMap: Record<string, Record<string, string>> = {};

    for (const row of contentRows ?? []) {
      const code = row.activity_code as string;
      const c = row.content as ActivityContent;

      if (code === "__selected_standards") {
        standards = (c.items ?? []) as typeof standards;
        continue;
      }
      if (code === "__selected_ideas") {
        ideas = (c.items ?? []) as typeof ideas;
        continue;
      }
      if (code.endsWith("__opinion")) {
        if (c?.active !== false && c?.question) {
          const opinionKey = code.slice(0, -"__opinion".length);
          opinionsMap[opinionKey] = { question: c.question, responses: [] };
        }
        continue;
      }
      const resIdx = code.indexOf("__opinion_res_");
      if (resIdx !== -1) {
        const opinionKey = code.slice(0, resIdx);
        const uid = code.slice(resIdx + "__opinion_res_".length);
        if (!opinionResMap[opinionKey]) opinionResMap[opinionKey] = {};
        opinionResMap[opinionKey][uid] = c?.response ?? "";
        continue;
      }
      contents[code] = c;
    }

    // 의견묻기 응답과 이름 매핑
    const allResUids = Object.values(opinionResMap).flatMap(m => Object.keys(m));
    const uniqueUids = [...new Set(allResUids)];
    const { data: resProfiles } = uniqueUids.length > 0
      ? await supabase.from("profiles").select("id, display_name, email").in("id", uniqueUids)
      : { data: [] };
    const nameById: Record<string, string> = {};
    for (const p of resProfiles ?? []) {
      nameById[p.id] = p.display_name ?? p.email ?? "알 수 없음";
    }

    const opinions = Object.entries(opinionsMap).map(([key, val]) => ({
      question: val.question,
      responses: Object.entries(opinionResMap[key] ?? {}).map(([uid, response]) => ({
        name: nameById[uid] ?? uid,
        response,
      })),
    }));

    // 4) HTML 생성
    const generatedAt = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const html = buildHtml({
      title: lesson.title ?? "제목 없음",
      targetGrade: lesson.target_grade ?? null,
      relatedSubjects: lesson.related_subjects ?? null,
      numClasses: lesson.num_classes ?? null,
      numStudents: lesson.num_students ?? null,
      totalSessions: lesson.total_sessions ?? null,
      members,
      contents,
      standards,
      ideas,
      opinions,
      generatedAt,
    });

    // 5) Playwright → PDF
    const browser = await launchBrowser();
    try {
      const page = await (await browser.newContext()).newPage();
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.evaluate(() => (document as unknown as { fonts?: { ready: Promise<void> } }).fonts?.ready);
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
      });
      const safeTitle = (lesson.title ?? "report").replace(/[^\w가-힣\s-]/g, "").trim().replace(/\s+/g, "_");
      return new Response(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(safeTitle)}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    } finally {
      await browser.close();
    }
  } catch (err) {
    console.error("[pdf]", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
