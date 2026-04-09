# PDF 출력 MVP — 기술 문서

> 작성일: 2026-04-09  
> 대상 파일: `src/app/api/pdf/route.ts`, `src/components/workspace/WorkspaceShell.tsx`

---

## 1. 개요

워크스페이스 상단의 **"출력"** 버튼을 누르면 현재 프로젝트의 전체 설계 내용을 A4 PDF로 자동 생성하여 다운로드한다.  
렌더링 방식은 **HTML → Playwright(Chromium) → PDF** 파이프라인이다.  
서버사이드 전용 Node.js 런타임으로 실행되며, Vercel 서버리스 함수로 배포된다.

---

## 2. 기술 스택

| 역할 | 패키지 | 버전 |
|------|--------|------|
| 브라우저 자동화 | `playwright-core` | `^1.59.1` |
| 서버리스 Chromium 바이너리 | `@sparticuz/chromium-min` | `^143.0.4` |
| DB 접근 (서비스 롤) | `@supabase/supabase-js` | `^2.99.0` |
| 프레임워크 | Next.js (App Router) | `16.1.6` |
| 런타임 | Node.js (서버리스) | — |

---

## 3. 요청 흐름

```
[WorkspaceShell.tsx]
  "출력" 버튼 클릭
       │
       ▼
  GET /api/pdf?lessonId={uuid}
       │
       ▼
[route.ts]
  1. Supabase에서 데이터 조회 (4개 테이블)
  2. buildHtml() — 데이터를 HTML 문자열로 직렬화
  3. Playwright 브라우저 실행
  4. page.setContent(html) → page.pdf()
  5. PDF 바이너리 Response 반환
       │
       ▼
[WorkspaceShell.tsx]
  Blob URL 생성 → <a> 클릭 → 파일 다운로드
  파일명: "{projectTitle}.pdf"
```

---

## 4. 프론트엔드 (WorkspaceShell.tsx)

**위치:** `src/components/workspace/WorkspaceShell.tsx:808, 1892–1927`

```ts
const [pdfLoading, setPdfLoading] = useState(false);

// 출력 버튼 onClick
const res = await fetch(`/api/pdf?lessonId=${lessonId}`);
if (!res.ok) throw new Error(await res.text());
const blob = await res.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = `${projectTitle || "report"}.pdf`;
a.click();
URL.revokeObjectURL(url);
```

- `pdfLoading` 상태로 버튼 비활성화 + 스피너 표시
- 에러 발생 시 `alert()` 노출

---

## 5. API 라우트 상세 (`GET /api/pdf`)

**파일:** `src/app/api/pdf/route.ts`

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
```

### 5.1 Supabase 데이터 조회 (순서대로)

| 순서 | 테이블 | 조건 | 목적 |
|------|--------|------|------|
| 1 | `lessons` | `id = lessonId` | 수업 기본 정보 |
| 2 | `lesson_members` | `lesson_id = lessonId` | 멤버 user_id 목록 |
| 3 | `profiles` | `id IN (member_ids)` | 멤버 이름/이메일 |
| 4 | `activity_contents` | `lesson_id = lessonId` | 카드 입력값 전체 |
| 5 | `profiles` | `id IN (opinion_res_user_ids)` | 의견 응답자 이름 |

> Supabase 클라이언트는 `SUPABASE_SERVICE_ROLE_KEY`를 사용하여 RLS를 우회한다.

### 5.2 activity_contents 파싱 규칙

`activity_contents` 행의 `activity_code` 값에 따라 역할이 달라진다:

| `activity_code` 패턴 | 처리 방식 |
|----------------------|-----------|
| `__selected_standards` | `content.items[]` → 성취기준 배열 |
| `__selected_ideas` | `content.items[]` → 핵심아이디어 배열 |
| `{code}__opinion` | 의견묻기 질문 (`content.active !== false && content.question`) |
| `{code}__opinion_res_{userId}` | 의견 응답 (`content.response`) |
| 그 외 | 카드 콘텐츠 (`contents[code] = content`) |

### 5.3 HTML 생성 (`buildHtml`)

단일 함수로 전체 HTML 문자열을 생성한다. 주요 입력 파라미터:

```ts
buildHtml({
  title, targetGrade, relatedSubjects,
  numClasses, numStudents, totalSessions,
  members,      // [{ name, email }]
  contents,     // Record<activityCode, ActivityContent>
  standards,    // [{ code, subject, domain, content }]
  ideas,        // [{ subject, domain, content }]
  opinions,     // [{ question, responses: [{ name, response }] }]
  generatedAt,
})
```

**HTML 구조:**

```
<html>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: 'Noto Sans KR' (Google Fonts CDN); }

  .cover          — 수업명 + 정보 칩 + 팀원 + 생성일
  .section        — 성취기준 / 핵심아이디어 / 의견묻기
  .phase-block    — T/A/Ds/DI/E 단계별 내용
    .section-block  — 하위 섹션
      .activity-item  — 카드 코드 + 내용
  .footer         — 생성일
```

**카드 렌더링 특수 처리:**

| 조건 | 렌더링 |
|------|--------|
| `act.code === "T-2-1" && c.rows` | `<table class="role-table">` (이름/역할 표) |
| 그 외 | `<p class="activity-text">` (줄바꿈 `\n → <br>`) |
| `c.status === "completed"` | 파란 "완료" 배지 |
| `c.status === "skipped"` | 회색 "건너뜀" 배지 |

**텍스트 보안 처리:**

모든 사용자 입력은 `esc()` 함수를 거쳐 HTML 인젝션을 방지한다:
```ts
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
          .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
```

### 5.4 Playwright PDF 변환

```ts
const browser = await launchBrowser();
const page = await (await browser.newContext()).newPage();
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts?.ready);   // 웹폰트 로드 대기
const pdf = await page.pdf({
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
});
```

`waitUntil: "networkidle"` + `document.fonts.ready` 조합으로 Google Fonts(Noto Sans KR) 완전 로드를 보장한다.

### 5.5 브라우저 실행 전략 (`launchBrowser`)

| 환경 | 실행 방식 |
|------|-----------|
| `NODE_ENV === "development"` | 시스템 Chrome / Edge 경로 순차 탐색 후 직접 실행 |
| 프로덕션 | `@sparticuz/chromium-min`으로 `CHROMIUM_PACK_URL`에서 바이너리 다운로드 후 실행 |

개발 환경에서 탐색하는 경로:
```
C:\Program Files\Google\Chrome\Application\chrome.exe
C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
C:\Program Files\Microsoft\Edge\Application\msedge.exe
C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
process.env.CHROME_PATH  (커스텀 경로 지정 시)
```

### 5.6 응답 형식

```
HTTP 200
Content-Type: application/pdf
Content-Disposition: attachment; filename="{URL인코딩된_수업명}.pdf"
Cache-Control: no-store
Body: PDF 바이너리 (Uint8Array)
```

파일명은 수업명에서 특수문자(`[^\w가-힣\s-]`)를 제거하고 공백을 `_`로 치환한다.

---

## 6. Vercel 배포 설정

**파일:** `vercel.json`

```json
{
  "functions": {
    "src/app/api/pdf/route.ts": {
      "maxDuration": 60,
      "memory": 3008
    }
  }
}
```

| 항목 | 값 | 이유 |
|------|----|------|
| `maxDuration` | 60초 | Chromium 실행 + 웹폰트 로드 포함 시 10초 초과 가능 |
| `memory` | 3008 MB | Chromium 프로세스 메모리 요구량 |
| 플랜 | **Vercel Pro 이상 필수** | Hobby 플랜은 maxDuration 10초 제한 |

### 필수 환경변수

| 변수명 | 예시 값 | 설명 |
|--------|--------|------|
| `CHROMIUM_PACK_URL` | `https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.tar` | `@sparticuz/chromium-min` 바이너리 URL |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | RLS 우회용 서비스 롤 키 |

> `CHROMIUM_PACK_URL`은 설치된 `@sparticuz/chromium-min` 버전과 일치해야 한다.  
> 버전 확인: `package.json` → `@sparticuz/chromium-min: ^143.0.4`  
> 릴리즈 목록: https://github.com/Sparticuz/chromium/releases

---

## 7. 현재 구현의 제약사항

| 항목 | 내용 |
|------|------|
| **폰트 의존** | Google Fonts CDN에서 Noto Sans KR을 런타임에 로드. 네트워크 불안정 시 tofu(□) 발생 가능 |
| **카드 포맷** | 구조화 입력(structured) 미지원. `content.text` 문자열만 렌더링. `type: "structured"` 카드는 표시 안 됨 |
| **T-2-1 전용** | 역할 분담 카드만 표로 렌더링. 나머지 카드는 모두 plain text |
| **페이지 번호** | CSS `@page` 기반으로 자동 처리하지 않음. 현재 없음 |
| **콘텐츠 없는 카드** | `content.text`가 비어 있으면 해당 카드 전체 생략 |
| **타임아웃** | Google Fonts 로드 + Chromium 초기화 포함 시 느린 네트워크에서 60초 초과 가능 |
| **동시 요청** | 각 요청마다 Chromium 인스턴스를 신규 생성. 동시 다수 요청 시 메모리 부족 위험 |

---

## 8. 로컬 개발 실행

```bash
# Chrome 또는 Edge가 설치되어 있어야 함
npm run dev

# 브라우저에서
GET http://localhost:3000/api/pdf?lessonId={실제_lessonId}
```

또는 `CHROME_PATH` 환경변수로 브라우저 경로를 직접 지정:
```bash
CHROME_PATH="C:\custom\chrome.exe" npm run dev
```

---

## 9. 파일 위치 요약

```
src/
├── app/api/pdf/
│   └── route.ts          ← 서버 API (HTML 생성 + Playwright PDF 변환)
└── components/workspace/
    └── WorkspaceShell.tsx ← "출력" 버튼 및 다운로드 트리거 (L808, L1892–1927)

vercel.json               ← maxDuration:60, memory:3008 설정
```
