# Vercel 환경에서의 협력적 수업설계 보고서 PDF 구현 지시서

본 문서는 현재 동작 중인 **HTML → Playwright → PDF** MVP 파이프라인(`src/app/api/pdf/route.ts`) 위에, 앞서 설계한 「협력적 수업설계안 보고서」의 최종 레이아웃을 구현하기 위한 지시서다. 참고 문서:

- `PDF_MVP_기술문서.md` — 현재 구현 상태(Next.js App Router + `playwright-core` + `@sparticuz/chromium-min` on Vercel Pro)
- `PDF_생성_구현_지시서.md` — 보고서 자체의 섹션/레이아웃 정의(ReportLab 레퍼런스)
- `카드_재설계_지시서.md` — 입력 카드의 필드 스키마

**핵심 원칙**

1. **기존 기술 스택을 유지한다.** 새로운 의존성(puppeteer, jspdf, pdfkit 등)을 추가하지 않는다. 모든 변경은 `route.ts` 내부와 HTML/CSS 레벨에서 끝나야 한다.
2. **ReportLab 샘플(`make_report_v3.py`)은 레이아웃의 진실 원천**이다. 이를 HTML/CSS로 충실히 번역한다.
3. Playwright의 `page.pdf()` 옵션과 CSS Paged Media 기능만으로 모든 페이지 장식(헤더 라인, 푸터, 페이지 번호, 챕터 페이지 분리)을 구현한다.
4. 카드 입력이 아직 구조화(structured)되지 않은 항목은 **기존 프리텍스트 렌더를 폴백**으로 유지한다. 재설계된 카드 스키마가 들어오면 그 값을 우선 사용한다.

---

## 1. 구현 범위

| 구분              | 범위                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| 변경 파일         | `src/app/api/pdf/route.ts` (주 대상), `vercel.json`(변경 없음), `package.json`(새 의존성 없음)            |
| 신규 파일         | 없음. `buildHtml` 내부에 섹션 렌더 함수를 모듈로 분리해도 좋으나 단일 파일 유지 권장                        |
| 변경 금지         | `WorkspaceShell.tsx` 의 "출력" 버튼 흐름, Supabase 조회 로직, 런타임/메모리 설정, Playwright 런치 전략       |
| 결과물            | GET `/api/pdf?lessonId=...` 호출 시 앞서 설계한 최종 보고서와 시각적으로 동등한 PDF가 반환                    |

---

## 2. 데이터 계약 (Supabase → 렌더러 입력)

`route.ts` 는 이미 다음을 조회한다: `lessons`, `lesson_members`, `profiles`, `activity_contents`. 기존 파싱 규칙을 유지하되, 아래 **구조화 필드 우선 해석** 규칙을 추가한다.

### 2.1 activity_code 매핑

기존 규칙(`__selected_standards`, `__selected_ideas`, `{code}__opinion`, `{code}__opinion_res_{userId}`)은 그대로 둔다. 일반 카드의 `activity_code` → 보고서 섹션 매핑을 다음과 같이 고정한다.

| activity_code | 보고서 위치                             | 구조화 필드(우선)                                              | 폴백(기존 프리텍스트)          |
| ------------- | --------------------------------------- | ------------------------------------------------------------- | ------------------------------- |
| `T-1-1`       | 1.1 팀 공동 비전                         | `content.vision`, `content.vision_note`                         | `content.text`                  |
| `T-1-2`       | 1.2 수업설계 방향                         | `content.directions[]`                                          | `content.text`                  |
| `T-2-1`       | 1.3 역할 배분                             | `content.roles[]` 또는 기존 `content.rows[]`                     | `content.text`                  |
| `T-2-2`       | 1.4 팀 규칙                               | `content.rules[]`                                               | `content.text`                  |
| `T-2-3`       | 1.5 단계별 일정                           | `content.schedule[]` (열: due_date/content/deliverable)          | `content.text`                  |
| `A-1-1`       | 2.1 주제 선정 기준                       | `content.criteria[]`                                            | `content.text`                  |
| `A-1-2`       | 2.1 최종 주제                             | `content.candidates[]`, `content.final_topic`, `content.selection_rationale` | `content.text`        |
| `A-2-1`       | 2.2–2.3 핵심 아이디어·성취기준            | `content.core_ideas[]`, `content.achievement_standards[]` (+ `__selected_standards`, `__selected_ideas` 병합) | `content.text` |
| `A-2-2`       | 2.4 통합 수업 목표                       | `content.integration_narrative`, `content.integrated_goal`       | `content.text`                  |
| `Ds-1-1`      | 3.1 평가 내용 및 방법                     | `content.eval_questions[]`, `content.eval_methods[]`, `content.rubric[]` | `content.text`         |
| `Ds-1-2`      | 3.2 문제 상황 아이디어 나열                | `content.problem_situations[]`, `content.selection_rationale`    | `content.text`                  |
| `Ds-1-3`      | 3.3 학습자 활동 아이디어                  | `content.activities[]`                                          | `content.text`                  |
| `Ds-2-1`      | 3.4 지원 도구                             | `content.support_tools[]` (+ related_period 열 필수)             | `content.text`                  |
| `Ds-2-2`      | 3.5 스캐폴딩 방안                         | `content.scaffolding[]`                                         | `content.text`                  |
| `DI-1-1`      | 4.1 개발 자료 목록                        | `content.dev_materials[]`                                       | `content.text`                  |
| `DI-1-2`      | 4.2 검토 유의점                           | `content.review_considerations[]`                               | `content.text`                  |
| `DI-2-1`      | 4.3 수업 실행 일정                        | `content.exec_schedule[]`                                       | `content.text`                  |
| `DI-2-2`      | 4.4 수업별 수행 결과 확인 자료              | `content.outputs[]`                                             | `content.text`                  |
| `E` 루트      | 5. 평가·성찰                              | `content.design_rubric[]`, `content.reflection_note`             | `content.text`                  |

### 2.2 타입 선언(추가)

`route.ts` 상단 타입 블록에 다음 유니언 타입을 추가한다.

```ts
type CardContent = {
  text?: string;
  status?: "completed" | "skipped";
  // 구조화 필드 (카드별)
  vision?: string; vision_note?: string;
  directions?: string[];
  roles?: Array<{ name: string; subject: string; core_role: string; area: string }>;
  rows?: Array<{ name: string; role?: string }>; // 기존 호환
  rules?: string[];
  schedule?: Array<{ due_date: string; content: string; deliverable: string }>;
  criteria?: string[];
  candidates?: string[]; final_topic?: string; selection_rationale?: string;
  core_ideas?: Array<{ subject: string; core_idea: string }>;
  achievement_standards?: Array<{ subject: string; code: string; statement: string }>;
  integration_narrative?: string; integrated_goal?: string;
  eval_questions?: string[];
  eval_methods?: Array<{ type: string; target: string; method: string; timing: string }>;
  rubric?: Array<{ axis: string; level_4: string; level_3: string; level_2: string }>;
  problem_situations?: Array<{ situation: string; decision: string }>;
  activities?: Array<{ period: string; activity: string; linked_standards: string[] }>;
  support_tools?: Array<{ stage: string; tool: string; purpose: string; related_period: string }>;
  scaffolding?: Array<{ activity: string; plan: string }>;
  dev_materials?: Array<{ member: string; material: string; content: string; reviewer: string }>;
  review_considerations?: string[];
  exec_schedule?: Array<{ period: string; date: string; time: string; place: string; teacher: string }>;
  outputs?: Array<{ period: string; output_desc: string }>;
  design_rubric?: Array<{ area: string; question: string; score: string }>;
  reflection_note?: string;
};
```

### 2.3 폴백 렌더 규칙

구조화 필드가 하나라도 존재하면 **그 필드만** 렌더한다(프리텍스트 혼합 금지). 구조화 필드가 전부 비어 있을 때만 `content.text`를 렌더한다. `content.text` 도 없고 구조화 필드도 비어 있으면 해당 카드 섹션은 섹션 헤더만 출력하고 본문은 `<p class="empty">(입력된 내용이 없습니다.)</p>` 로 채운다.

---

## 3. HTML/CSS 구조

전면적으로 다시 설계한다. 아래는 필수 클래스와 의미. 모든 텍스트는 `esc()`를 거친다.

### 3.1 최상위 스켈레톤

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<title>${esc(title)}</title>
<style>/* §3.2 CSS */</style>
</head>
<body>
  <main>
    <section class="cover">…</section>

    <section class="toc-overview">…</section>   <!-- 목차 + 수업 개요 + 팀 구성 -->

    <section class="chapter" data-num="1"><!-- 팀 준비 -->…</section>
    <section class="chapter" data-num="2"><!-- 분석 -->…</section>
    <section class="chapter" data-num="3"><!-- 설계 -->…</section>
    <section class="chapter" data-num="4"><!-- 개발·실행 -->…</section>
    <section class="chapter" data-num="5"><!-- 평가·성찰 -->…</section>
  </main>
</body>
</html>
```

### 3.2 CSS — 필수 규칙

다음 규칙을 반드시 포함한다.

```css
/* ---- 폰트 ---- */
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap');

:root{
  --purple:#534AB7;
  --purple-dark:#3E368A;
  --mint:#9FE1CB;
  --dark:#1F2937;
  --gray:#6B7280;
  --light:#F3F4F6;
  --soft-purple:#EEF0FB;
  --border:#D1D5DB;
}

*{box-sizing:border-box}
html,body{padding:0;margin:0;color:var(--dark);font-family:'Noto Sans KR',sans-serif}
body{font-size:9.6pt;line-height:1.48;-webkit-print-color-adjust:exact;print-color-adjust:exact}

/* ---- 페이지 장식 ---- */
@page {
  size: A4;
  margin: 18mm 20mm 22mm 20mm;
  @top-left { content: ""; }
  @bottom-left {
    font-family:'Noto Sans KR',sans-serif;
    font-size: 8pt; color: var(--gray);
    content: "${LESSON_TITLE_PLACEHOLDER}";   /* ← 빌드 시 치환 */
  }
  @bottom-right {
    font-family:'Noto Sans KR',sans-serif;
    font-size: 8pt; color: var(--gray);
    content: "- " counter(page) " -";
  }
}
@page cover {
  margin: 0;
  @bottom-left { content: ""; }   /* 표지에는 푸터 없음 */
  @bottom-right{ content: ""; }
}
.cover { page: cover; }

/* 본문 상단의 얇은 보라 라인 (헤더 라인 대체용) */
.chapter, .toc-overview { border-top: 0.8pt solid var(--purple); padding-top: 6mm; }

/* ---- 강제 페이지 분할 ---- */
.cover        { page-break-after: always; }
.toc-overview { page-break-after: always; }
.chapter      { page-break-before: always; }
.page-break   { page-break-after: always; }

/* ---- 타이포그래피 ---- */
h1.title { font-size: 26pt; color: var(--purple); text-align:center; margin: 0 0 4mm; font-weight:700; }
p.subtitle { font-size: 12pt; color: var(--gray); text-align:center; margin: 0; }

h2.section { font-size: 11.5pt; color: var(--purple-dark); margin: 8mm 0 2mm; font-weight:700; }
h3.sub    { font-size: 10.3pt; color: var(--dark); margin: 5mm 0 1.5mm; font-weight:700; }
p, li     { font-size: 9.6pt; line-height: 1.48; margin: 0 0 3pt; }
ul.bullets{ margin: 0 0 3mm 5mm; padding:0; }
ul.bullets li { list-style: disc; margin-bottom: 1.5pt; }

/* ---- 챕터 헤더 바 ---- */
.chapter-header {
  background: var(--purple); color:#fff;
  padding: 10px 12px; border-bottom: 2pt solid var(--mint);
  font-weight:700; font-size:16pt; margin-bottom: 5mm;
}

/* ---- 표 ---- */
table.data {
  width:100%; border-collapse: collapse; table-layout: fixed;
  font-size: 8.8pt;
}
table.data th, table.data td {
  border: 0.3pt solid var(--border);
  padding: 5px 6px; vertical-align: middle;
  word-break: keep-all; overflow-wrap: anywhere;  /* 셀 오버플로 방지 — 강한 규칙 */
}
table.data thead th {
  background: var(--purple); color:#fff; font-weight:700; text-align:center;
  font-size: 9.2pt;
}
table.data tbody tr:nth-child(even) td { background: #F9FAFB; }
table.data td.c, table.data th.c { text-align:center; }
table.data colgroup col { }  /* width는 inline으로 지정 */

/* ---- 강조 박스 ---- */
.emphasis-box {
  background: var(--soft-purple); border:0.8pt solid var(--purple);
  padding: 8px 10px; color: var(--purple-dark);
  margin: 3mm 0;
}
.emphasis-box .label { font-weight:700; margin-right: 6pt; }

/* ---- 2단 레이아웃 (2.2) ---- */
.two-col { display:flex; gap:6mm; align-items:center; margin: 3mm 0; }
.two-col .text { flex: 100 0 0; }
.two-col .figure { flex: 70 0 0; text-align:center; }
.two-col svg { width: 100%; max-width: 70mm; height:auto; }

/* ---- 표지 ---- */
.cover { position:relative; height:297mm; padding: 55mm 20mm 20mm; }
.cover::before {  /* 왼쪽 세로 바 (상단 60mm mint, 나머지 purple) */
  content:""; position:absolute; left:0; top:0; width:8mm; height:60mm; background:var(--mint);
}
.cover::after {
  content:""; position:absolute; left:0; top:60mm; width:8mm; height:calc(297mm - 60mm); background:var(--purple);
}
.cover .meta {
  margin-top: 28mm; border: 0.6pt solid var(--purple);
  width:100%; border-collapse:collapse;
}
.cover .meta th, .cover .meta td { padding: 9px 10px; font-size: 10pt; border: 0.3pt solid #E5E7EB; }
.cover .meta th { background: var(--light); color: var(--purple); text-align:left; font-weight:700; width: 35mm; }

/* ---- 목차 ---- */
ol.toc { list-style:none; padding:0; margin: 0 0 6mm; }
ol.toc li {
  display:flex; justify-content:space-between;
  border-bottom: 0.3pt solid #E5E7EB; padding: 5pt 0; font-size: 10pt;
}

/* ---- 체크리스트 셀 ---- */
.check-cell { text-align:center; width: 6mm; font-size: 9pt; }
.check-cell.on { background: var(--purple); color:#fff; }

/* ---- 빈 섹션 ---- */
p.empty { color: var(--gray); font-style: italic; }
```

**치환 주의**: `@bottom-left { content: "…"; }`에는 동적 문자열(수업 제목)을 넣어야 한다. 작은따옴표/큰따옴표·특수문자가 들어갈 수 있으므로 **HTML esc 후 CSS 문자열 이스케이프**(`"` → `\"`, 백슬래시 → `\\`)를 거친 결과를 문자열 템플릿에 삽입한다. `lesson_title`이 없으면 content를 빈 문자열로 둔다.

### 3.3 섹션별 HTML 골격

각 섹션 헬퍼 함수를 `route.ts` 내부에 추가한다. 이름은 제안일 뿐 팀 컨벤션을 따라도 좋다.

```ts
function renderCover(d): string { … }         // <section class="cover">
function renderTocOverview(d): string { … }   // <section class="toc-overview">
function renderChapterT(d): string { … }      // 1. 팀 준비
function renderChapterA(d): string { … }      // 2. 분석
function renderChapterDs(d): string { … }     // 3. 설계
function renderChapterDI(d): string { … }     // 4. 개발·실행
function renderChapterE(d): string { … }      // 5. 평가·성찰
```

#### 3.3.1 표지

```html
<section class="cover">
  <h1 class="title">협력적 수업설계안 보고서</h1>
  <p class="subtitle">${esc(lessonTitle)}</p>
  <p class="subtitle">— ${esc(targetGrade)} ${esc(subjectsJoined)} 융합 PBL —</p>
  <table class="meta">
    <tr><th>수업명</th><td>${esc(lessonTitle)}</td></tr>
    <tr><th>대상 학년</th><td>${esc(targetGrade)} (${numClasses}개 학급, 총 ${numStudents}명)</td></tr>
    <tr><th>교과(융합)</th><td>${esc(subjectsJoined)}</td></tr>
    <tr><th>총 차시</th><td>${totalSessions}차시</td></tr>
    <tr><th>설계 방식</th><td>T·A·Ds·DI·E 5단계 협력적 수업설계</td></tr>
    <tr><th>작성일</th><td>${fmtDate(generatedAt)}</td></tr>
  </table>
</section>
```

#### 3.3.2 목차 + 수업 개요 + 팀 구성

- "목차"는 제목 포함 `<ol class="toc">` 으로 출력.
  항목 순서 고정:
  ```
  수업 개요 — 2
  팀 구성 — 2
  1. 팀 준비 (T) — 3
  2. 분석 (A) — 4
  3. 설계 (Ds) — 5
  4. 개발·실행 (DI) — 7
  5. 평가·성찰 (E) — 8
  ```
  실제 페이지는 콘텐츠에 따라 달라질 수 있으나, **2-pass 빌드는 하지 않는다**. 정적 숫자로 가되 "약 N쪽" 같은 표기는 금지.

- **"수업 개요"** 는 번호 없는 `<h2 class="section">`. 2열 표로 수업 주제/목적/대상/관련 성취기준/핵심 아이디어를 표기. 관련 성취기준 셀은 `<ul class="bullets">` 로 코드 볼드 불릿을 출력: `• <strong>[9과17-01]</strong> 설명…`.

- **"팀 구성"** 도 번호 없는 `<h2 class="section">`. 3열 표(학교/이름/과목), **모든 셀 가운데 정렬**(`class="c"`).

#### 3.3.3 1. 팀 준비

`<div class="chapter-header">1. 팀 준비 (T)</div>` 이후:

- 1.1 공동 비전: `.vision` 문장 → 본문 단락. `vision_note` 가 있으면 이어 붙임.
- 1.2 설계 방향: `<ul class="bullets">` + 각 항목 `<strong>` 강조 허용.
- 1.3 역할 배분: 4열 표(이름/과목/핵심 역할/담당 영역). 이름·과목 열 가운데 정렬. 새 스키마 `roles[]` 우선, 없으면 기존 `rows[]` 호환.
- 1.4 팀 규칙: **`<ul class="bullets">` 로만 렌더. 표 금지.**
- 1.5 단계별 일정: **3열 표(목표 완료일 → 내용 → 산출물)**. 첫 열 가운데 정렬. '단계' 열 두지 않음.

#### 3.3.4 2. 분석

- 2.1 주제 선정:
  - "세 교과 공통의 주제 선정 기준은 다음과 같다." 본문
  - `<ul class="bullets">` 로 `criteria`
  - 후보 요약 본문
  - `<div class="emphasis-box"><span class="label">최종 선정 주제</span>${final_topic}</div>`
- 2.2 교과별 핵심 아이디어: `.two-col` 사용. 좌측 텍스트 + 우측 **인라인 SVG** 교차 다이어그램(§4 참고).
- 2.3 성취기준 분석: 2열 표(교과 / 성취기준). 성취기준 셀은 `<strong>[code]</strong> statement` **원문**.
- 2.4 연계 설명 + 통합 수업 목표: `integration_narrative` 본문 → "이러한 연계를 …" 한 문장 → `<div class="emphasis-box"><span class="label">통합 수업 목표</span>${integrated_goal}</div>`. 별도 2.5 번호 부여 금지.
- 마지막에 `<div class="page-break"></div>` 로 챕터 경계 보강(이미 `.chapter`가 page-break-before를 가지므로 생략해도 무방).

#### 3.3.5 3. 설계

- 3.1 평가(Ds-1-1): 안내 본문 + 3.1.1 평가 주제(`<ul class="bullets">`, 각 항목은 "~할 수 있는가?") + 3.1.2 평가 방법(4열 표, '평가 유형'·'시점' 가운데 정렬) + 3.1.3 루브릭(4열 표). 여기까지 한 쪽 안에 들어가지 못하면 `.page-break` 를 3.1.3 뒤에 둔다.
- 3.2 문제 상황(Ds-1-2): **2열 표(상황/채택 여부)**. 번호 열 금지.
- 3.3 학습자 활동(Ds-1-3): 3열 표(차시/활동/연결 성취기준). 차시 가운데 정렬. `linked_standards` 는 ", " 조인.
- 3.4 지원 도구(Ds-2-1): **4열 표(활동 단계/도구/목적/관련 차시)**. 관련 차시 가운데 정렬. `related_period` 열 누락 금지.
- 3.5 스캐폴딩(Ds-2-2): 2열 표(활동/방안).

#### 3.3.6 4. 개발·실행

- 4.1 개발 자료(DI-1-1): 4열 표. 팀원 이름·검토자 가운데 정렬.
- 4.2 검토 유의점(DI-1-2): `<ul class="bullets">`.
- 4.3 수업 실행 일정(DI-2-1): **5열 표(차시/날짜/시간/장소/담당 교사)**. **5개 열 모두 가운데 정렬**(`class="c"`).
- 4.4 수업별 수행 결과(DI-2-2): 2열 표(차시/자료). 차시 가운데 정렬.

#### 3.3.7 5. 평가·성찰

- 안내 본문 + 5.1 체크리스트 + 5.2 활용 안내.
- 체크리스트 표 열: 영역(select) / 평가 문항 / 4 / 3 / 2 / 1. 점수 칸은 `<td class="check-cell">☐</td>` 기본, `design_rubric[i].score === "4"` 면 해당 칸만 `class="check-cell on">■`.
- 5.2 활용 안내: 고정 불릿 4개(개별 평정→합의 / 2점 이하 환류 / 75% 이상 Reusable / 60% 미만 Rework).
- `reflection_note` 가 있으면 안내 뒤에 인용 블록(`<div class="emphasis-box">`)으로 표기.

### 3.4 공통 유틸 (route.ts 내부)

```ts
const esc = /* 기존 유지 */;

// CSS content 문자열 삽입용
const cssEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

// 날짜 포맷
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
};
const fmtMD = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth()+1}월 ${d.getDate()}일`;
};

// 표 헬퍼
function table(headers: string[], rows: Array<Array<string|{html:string}>>, opts: {
  colWidthsMm?: number[]; centerCols?: number[];
}): string {
  const { colWidthsMm = [], centerCols = [] } = opts;
  const colgroup = colWidthsMm.length
    ? `<colgroup>${colWidthsMm.map(w=>`<col style="width:${w}mm">`).join("")}</colgroup>`
    : "";
  const head = `<thead><tr>${headers.map((h,i)=>`<th class="${centerCols.includes(i)?'c':''}">${esc(h)}</th>`).join("")}</tr></thead>`;
  const body = `<tbody>${rows.map(r=>`<tr>${r.map((c,i)=>{
    const cls = centerCols.includes(i) ? "c" : "";
    const inner = typeof c === "string" ? esc(c).replace(/\n/g,"<br>") : c.html;
    return `<td class="${cls}">${inner}</td>`;
  }).join("")}</tr>`).join("")}</tbody>`;
  return `<table class="data">${colgroup}${head}${body}</table>`;
}

// 불릿
const bullets = (items: string[]) =>
  items.length
    ? `<ul class="bullets">${items.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>`
    : `<p class="empty">(입력된 내용이 없습니다.)</p>`;
```

`table` 헬퍼는 `{html: ...}` 로 raw HTML을 넘길 수 있어야 하며, 그때는 호출자가 직접 esc 처리한다. 예: 성취기준 셀에서 `<strong>[code]</strong>`를 쓰려면 `{ html: `<strong>${esc(code)}</strong> ${esc(statement)}` }` 형태.

---

## 4. 2.2 교과별 핵심 아이디어 — 인라인 SVG 다이어그램

matplotlib를 사용하지 않는다. **인라인 SVG**로 세 원을 그린다. `core_ideas` 배열에서 최대 3개 교과의 레이블을 추출하고, 중심에는 "탄소중립 실천" 같은 프로젝트 키워드를 자동 추출(불가 시 `lesson_title` 첫 10자)하여 표시한다.

```ts
function renderCoreIdeasSvg(core: Array<{subject:string}>, centerText: string): string {
  const subjects = core.slice(0,3).map(c=>c.subject);
  while (subjects.length < 3) subjects.push("");
  return `
  <svg viewBox="0 0 200 190" xmlns="http://www.w3.org/2000/svg">
    <circle cx="80"  cy="80"  r="55" fill="#534AB7" fill-opacity="0.42"/>
    <circle cx="120" cy="80"  r="55" fill="#9FE1CB" fill-opacity="0.55"/>
    <circle cx="100" cy="120" r="55" fill="#F59E0B" fill-opacity="0.42"/>

    <text x="55"  y="45" text-anchor="middle" font-size="12" font-weight="700" fill="#3E368A">${esc(subjects[0])}</text>
    <text x="145" y="45" text-anchor="middle" font-size="12" font-weight="700" fill="#0F766E">${esc(subjects[1])}</text>
    <text x="100" y="180" text-anchor="middle" font-size="12" font-weight="700" fill="#92400E">${esc(subjects[2])}</text>

    <rect x="62" y="92" rx="6" ry="6" width="76" height="22" fill="#3E368A"/>
    <text x="100" y="107" text-anchor="middle" font-size="10" font-weight="700" fill="#ffffff">${esc(centerText)}</text>
  </svg>`;
}
```

- `core` 가 비어 있으면 `.two-col` 대신 `text` 단독 렌더.
- SVG는 `font-family: 'Noto Sans KR'`을 상속한다.

---

## 5. 폰트 신뢰성 개선 (선택, 권장)

현재 MVP는 Google Fonts CDN 의존 → 네트워크 불안정 시 tofu(□) 위험이 있다. 다음 **폴백 전략**을 반영한다.

1. `@import url('…')` 은 그대로 유지(빠른 경로).
2. `body` 의 `font-family` 에 폴백을 추가: `'Noto Sans KR','Nanum Gothic','Apple SD Gothic Neo','Malgun Gothic',sans-serif`.
3. `page.evaluate(() => document.fonts?.ready)` 는 이미 있음. 여기에 타임아웃 5초를 두어 폰트 로드가 지연되면 강제 진행:
   ```ts
   await Promise.race([
     page.evaluate(() => document.fonts?.ready as any),
     new Promise(r => setTimeout(r, 5000)),
   ]);
   ```
4. 향후 개선(본 작업 범위 밖): `public/fonts/NotoSansKR-*.woff2`를 추가하고 CSS에 `@font-face` 로 자체 호스팅.

---

## 6. `route.ts` 변경 체크리스트

1. [ ] `CardContent` 타입 선언 추가.
2. [ ] `esc`, `cssEsc`, `fmtDate`, `fmtMD`, `table`, `bullets` 유틸 함수 추가/정리.
3. [ ] `buildHtml` 시그니처를 유지하되, 내부를 다음 순서로 재구성:
   - `css = buildCss(lessonTitle)` — `@page` content에 `cssEsc(lessonTitle)` 삽입
   - `body = renderCover(d) + renderTocOverview(d) + renderChapterT(d) + renderChapterA(d) + renderChapterDs(d) + renderChapterDI(d) + renderChapterE(d)`
   - `return `<!doctype html><html>…</html>``
4. [ ] 각 `renderChapter*` 함수에서 구조화 필드 → 폴백(`content.text`) → 빈 상태 순으로 분기.
5. [ ] `T-2-1` 특수 렌더(기존 `rows`)를 1.3 렌더 함수 안으로 흡수한 뒤, 바깥 공통 카드 루프(있다면) 제거. 현재는 `activity_code` 별 전용 렌더만 있어야 한다.
6. [ ] `core_ideas` 가 있으면 `renderCoreIdeasSvg()` 호출, 없으면 단일 칼럼 폴백.
7. [ ] `page.pdf()` 옵션은 그대로 유지하되 `preferCSSPageSize: true` 는 **반드시 true**. 마진은 CSS `@page` 가 승리하도록 `margin: { top: 0, bottom: 0, left: 0, right: 0 }` 으로 둘 것(겹치기 방지).
8. [ ] 응답 헤더·Cache-Control·파일명 규칙은 그대로 둔다.

---

## 7. 빈 상태 및 에러 처리

- 특정 카드가 비어 있으면 해당 소절 헤더도 생략하지 않고, 본문만 "(입력된 내용이 없습니다.)" 로 출력한다. 이유: 목차·번호 흐름 일관성 유지.
- `lessons` 조회 실패 시 기존 404 처리 유지.
- `buildHtml` 내부에서 throw하지 말고, 섹션별로 try/catch 하여 문제 섹션만 `(렌더 오류)` 블록으로 대체한다.
- `console.error` 로 남기되 사용자 응답에는 상세 스택 노출 금지.

---

## 8. 수락 기준(Acceptance)

생성된 PDF는 앞서 확정한 레퍼런스(`협력적_수업설계안_보고서_v3.pdf`)와 **시각적으로 동등**해야 한다.

- [ ] 한글이 모두 Noto Sans KR 또는 폴백 한글 글꼴로 렌더되며 tofu가 없다.
- [ ] 표지에는 페이지 번호가 없고, 본문 모든 쪽 좌측 하단에 `lessonTitle`, 우측 하단에 `- N -` 이 표시된다.
- [ ] 5개 챕터 각각이 새 페이지에서 시작하며, 보라색 배경 + 민트 밑줄의 챕터 헤더 바가 있다.
- [ ] 모든 표 셀에서 오버플로가 발생하지 않는다 (word-break: keep-all + overflow-wrap: anywhere 적용).
- [ ] 성취기준은 `<strong>[code]</strong> 원문` 형태이며 요약되지 않는다.
- [ ] 문제 상황 표에 번호 열이 없다(2열).
- [ ] 단계별 일정 표의 첫 열이 "목표 완료일"이다.
- [ ] 수업 실행 일정 표의 차시/날짜/시간/장소/담당 교사 셀이 모두 가운데 정렬된다.
- [ ] 지원 도구 표에 "관련 차시" 열이 존재한다.
- [ ] 평가 주제는 불릿 리스트이며 항목 끝이 "~할 수 있는가?" 형태로 제시된다.
- [ ] 2.2 교과별 핵심 아이디어가 좌측 텍스트 + 우측 SVG 다이어그램의 2단 레이아웃이다.
- [ ] "Minerva"/"미네르바" 등 브랜드명이 결과물 어디에도 없다.
- [ ] Vercel Pro 서버리스 환경에서 60초 이내에 응답한다(서버 로그로 확인).

---

## 9. 로컬 테스트 방법

1. `.env.local` 에 `CHROMIUM_PACK_URL` 과 Supabase 키 설정(`PDF_MVP_기술문서.md` §6 참조).
2. Supabase 테스트 프로젝트에 구조화 필드가 채워진 레퍼런스 `activity_contents` 레코드를 1건 이상 생성(없다면 프리텍스트 `text` 필드라도 채운다).
3. `npm run dev` → `GET http://localhost:3000/api/pdf?lessonId=<id>`.
4. 반환된 PDF를 열어 §8 수락 기준을 눈으로 검증.
5. 테스트용 픽스처가 없다면, `route.ts` 상단에 임시 `if (lessonId === "__demo__") return buildFromFixture()` 분기를 두고, `fixtures/reference_project.json` 을 읽어 렌더하는 샘플 경로를 제공해도 좋다(PR 병합 전 제거).

---

## 10. 변경하지 말 것

- `WorkspaceShell.tsx` 의 버튼·fetch 흐름·파일명 생성 로직
- `launchBrowser()` 구현 및 개발 환경 Chrome 경로 탐색
- `vercel.json`(maxDuration/memory)
- `@sparticuz/chromium-min` 또는 `playwright-core` 버전 업/다운
- Supabase 조회 순서·테이블·컬럼 매핑(§2에서 명시한 구조화 필드 해석만 추가)

---

## 11. 작업 커밋 제안

1. `feat(pdf): add structured card schema parsing in route.ts`
2. `feat(pdf): rewrite buildHtml layout to match final report spec`
3. `feat(pdf): inline SVG core-ideas diagram for section 2.2`
4. `feat(pdf): CSS @page footer with lesson title and page number`
5. `fix(pdf): prevent table cell overflow with keep-all and overflow-wrap`

각 커밋은 단독으로 빌드되고 렌더 가능해야 한다.

---

이 지시서의 목표는 **현재 MVP 파이프라인의 제약을 유지하면서**, 앞서 확정한 최종 보고서 레이아웃을 충실히 구현하는 것이다. 새 의존성 도입·런타임 교체 등의 구조 변경은 이번 작업 범위가 아니며, 필요하다면 별도 RFC로 분리한다.
