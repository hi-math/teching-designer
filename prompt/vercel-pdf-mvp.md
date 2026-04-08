# Vercel PDF MVP 구현 지시서 (for Claude Code)

## 목표
Vercel에 **최소 기능 PDF 생성 API**를 배포해서 "배포 자체가 된다"는 것부터 확인한다. 스타일·폰트·템플릿 디벨롭은 이후 단계. 이번 스텝에서는 다음 한 가지만 성공하면 된다.

> `GET /api/pdf` 를 호출하면 A4 1~2페이지짜리 한글이 포함된 PDF가 다운로드된다.

성공 기준:
1. `vercel --prod` 배포가 에러 없이 끝난다.
2. 배포된 URL의 `/api/pdf` 가 200과 `application/pdf` 를 반환한다.
3. 다운받은 파일이 실제로 열리고 한글이 깨지지 않는다.

---

## 스택
- **Next.js (App Router, TypeScript)** — Vercel 기본값
- **`@sparticuz/chromium-min`** — 서버리스용 경량 Chromium (바이너리는 외부 호스팅)
- **`playwright-core`** — Chromium 드라이버 (브라우저 번들 없는 경량 패키지)
- Runtime: **Node.js** (Edge 아님)
- 플랜: **Vercel Pro 권장** (Hobby 10초 제한으론 cold start 실패 가능)

> 선택 이유: 현재 벤치마크상 Playwright가 Puppeteer보다 빠르고, `chromium-min`은 바이너리를 번들에서 빼 50MB 함수 크기 제한을 우회한다.

---

## 프로젝트 초기 세팅

```bash
npx create-next-app@latest vercel-pdf-mvp \
  --ts --app --eslint --src-dir --no-tailwind --import-alias "@/*"
cd vercel-pdf-mvp

npm install playwright-core @sparticuz/chromium-min
```

## Chromium 바이너리 호스팅 URL
Sparticuz가 GitHub Releases에 올려둔 `.tar` 파일을 직접 링크한다. 현재 권장 URL 패턴:

```
https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar
```

> 버전은 설치된 `@sparticuz/chromium-min` 의 메이저 버전과 반드시 일치해야 한다. `npm ls @sparticuz/chromium-min` 으로 확인 후, 그 버전에 맞는 릴리스 URL을 쓸 것. 버전 불일치 시 런타임에 "Protocol error" 또는 launch 실패가 난다.

이 URL을 환경 변수로 분리한다:

`.env.local` (로컬은 이 변수 없어도 동작하게 처리)
```
CHROMIUM_PACK_URL=https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar
```

Vercel 프로젝트 환경변수에도 동일하게 추가 (`Production`, `Preview` 모두).

---

## 파일 구조

```
vercel-pdf-mvp/
├─ src/
│  └─ app/
│     └─ api/
│        └─ pdf/
│           └─ route.ts        ← PDF 생성 엔드포인트
├─ vercel.json                   ← 함수 리소스 설정
├─ package.json
└─ .env.local
```

---

## `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "functions": {
    "src/app/api/pdf/route.ts": {
      "maxDuration": 60,
      "memory": 3008
    }
  }
}
```

- `maxDuration: 60` — Pro 플랜 최대치. cold start 여유 확보.
- `memory: 3008` — Chromium 런칭 안정성 확보. 줄이면 OOM 가능.

---

## `src/app/api/pdf/route.ts`

```ts
import { NextResponse } from "next/server";
import chromium from "@sparticuz/chromium-min";
import { chromium as playwrightChromium } from "playwright-core";

// 반드시 Node.js runtime (Edge는 Chromium 불가)
export const runtime = "nodejs";
// 함수 인스턴스가 재사용될 때 브라우저도 재사용하고 싶으면 dynamic 지정
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CHROMIUM_PACK_URL = process.env.CHROMIUM_PACK_URL!;

async function launchBrowser() {
  const isLocal = process.env.NODE_ENV === "development";

  if (isLocal) {
    // 로컬에서는 설치되어 있는 시스템 Chrome/Chromium 사용
    return playwrightChromium.launch({ headless: true });
  }

  // Vercel 서버리스 환경
  const executablePath = await chromium.executablePath(CHROMIUM_PACK_URL);

  return playwrightChromium.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });
}

const HTML = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>PDF MVP</title>
  <style>
    @page { size: A4; margin: 20mm 15mm; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Noto Sans KR",
                   "Apple SD Gothic Neo", sans-serif;
      color: #1f2937;
      line-height: 1.7;
    }
    h1 { color: #ea580c; border-bottom: 2px solid #ea580c; padding-bottom: 8px; }
    .pill {
      display: inline-block;
      background: #fff7ed;
      color: #c2410c;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 14px;
      margin: 6px 0;
    }
    .callout {
      background: #fff7ed;
      border-left: 4px solid #ea580c;
      padding: 12px 16px;
      border-radius: 6px;
      margin: 16px 0;
    }
  </style>
</head>
<body>
  <h1>Vercel PDF MVP</h1>
  <div class="pill">🎯 배포 테스트</div>
  <p>이 문서는 Vercel 서버리스 함수에서 Playwright + Chromium 으로 생성된 PDF입니다.</p>
  <div class="callout">
    한글 렌더링과 CSS 스타일이 정상적으로 출력되는지 확인합니다.
  </div>
  <p>생성 시각: <code id="ts"></code></p>
  <script>document.getElementById("ts").textContent = new Date().toISOString();</script>
</body>
</html>`;

export async function GET() {
  let browser;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(HTML, { waitUntil: "networkidle" });
    // 웹폰트가 있다면 로딩 대기
    await page.evaluate(() => (document as any).fonts?.ready);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="mvp.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[pdf] failed:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  } finally {
    if (browser) await browser.close();
  }
}
```

### 포인트
- `export const runtime = "nodejs"` 필수. Edge Runtime 이면 Chromium 실행 불가.
- 로컬(`NODE_ENV=development`) 과 Vercel 환경을 분기. 로컬에서 `chromium-min` 쓰면 매번 바이너리 다운로드해서 느리다.
- `page.pdf()` 옵션 중 `printBackground: true` 가 있어야 배경색/뱃지가 나온다.
- `finally` 에서 반드시 `browser.close()` — 안 닫으면 다음 호출에서 메모리 초과.

---

## 로컬 개발 실행

```bash
# 로컬은 시스템 Chrome 사용 — 없으면 Playwright 브라우저 설치
npx playwright install chromium

npm run dev
# 다른 터미널에서:
curl -o out.pdf http://localhost:3000/api/pdf
open out.pdf
```

로컬에서 한글이 깨지지 않고 A4 한 장 나오면 OK.

---

## Vercel 배포

```bash
# 처음이라면
npm i -g vercel
vercel login
vercel link

# 환경 변수 등록 (한 번만)
vercel env add CHROMIUM_PACK_URL production
# 값 붙여넣기: https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar
vercel env add CHROMIUM_PACK_URL preview

# 프로덕션 배포
vercel --prod
```

배포 후:
```bash
curl -I https://<배포URL>/api/pdf
# → HTTP/2 200, content-type: application/pdf 확인

curl -o deployed.pdf https://<배포URL>/api/pdf
open deployed.pdf
```

---

## 검증 체크리스트

- [ ] `vercel --prod` 빌드가 에러 없이 끝났다
- [ ] `/api/pdf` 응답이 200이다
- [ ] 응답 헤더 `content-type: application/pdf`
- [ ] 다운받은 파일이 PDF 뷰어에서 열린다
- [ ] 한글("Vercel PDF MVP", "배포 테스트")이 깨짐 없이 보인다
- [ ] 오렌지 컬러 콜아웃과 pill이 배경색까지 제대로 나온다
- [ ] `vercel logs <URL>` 에 에러가 없다

---

## 자주 나는 에러 & 대응

**`Failed to launch the browser process` / `libnss3` 관련**
→ 그냥 Puppeteer `puppeteer` 패키지를 쓰면 나는 에러. `playwright-core` + `@sparticuz/chromium-min` 조합인지 확인.

**`Protocol error (Target.setAutoAttach)`**
→ Chromium 바이너리 버전과 `@sparticuz/chromium-min` 패키지 버전이 불일치. `npm ls @sparticuz/chromium-min` 으로 버전 확인 후 릴리스 URL 교체.

**`Function exceeded maximum duration`**
→ Hobby 플랜이거나 `vercel.json` 의 `maxDuration` 이 빠졌다. 둘 다 확인.

**`Response size too large` / 함수 번들 50MB 초과**
→ `@sparticuz/chromium` (min 아님) 을 실수로 설치. `chromium-min` 으로 교체.

**한글이 □□□ 로 나온다**
→ MVP 단계에서는 시스템 폰트 fallback으로도 보일 수 있으나, 깨지면 2단계에서 웹폰트 임베딩을 추가 (아래 Next steps 참고).

---

## 이후 디벨롭 단계 (2단계 이후)

MVP 배포가 확인되면 순서대로:

1. **Pretendard / Noto Sans KR 웹폰트 임베딩**
   - `@font-face` 로 CDN 또는 `/public/fonts/` 서빙
   - `page.evaluateHandle('document.fonts.ready')` 로 로딩 대기
2. **HTML 템플릿 분리** — React Server Component에서 `renderToString()` 으로 HTML 만들어 `page.setContent()` 에 주입
3. **POST 바디로 JSON 데이터 → PDF** (수업설계 리포트 구조)
4. **업로드한 `T-CID 종합 설계 보고서` 스타일 재현** — 오렌지 포인트, pill, 콜아웃, 좌측 바 인용구, 페이지 헤더/푸터
5. **Vercel Blob 에 결과 PDF 저장 후 URL 반환** (스트리밍 대신 다운로드 링크 방식)
6. **헤더/푸터 템플릿, 목차 자동 생성, 페이지 번호**
7. **캐싱 / 큐잉** — 동일 입력은 해시 기반 Blob 재사용

---

## 참고 링크
- Sparticuz chromium releases: https://github.com/Sparticuz/chromium/releases
- Playwright `page.pdf()`: https://playwright.dev/docs/api/class-page#page-pdf
- Vercel functions config: https://vercel.com/docs/functions/configuring-functions
