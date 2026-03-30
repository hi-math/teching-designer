# Teching Designer — 기본 플랫폼 가이드

재사용 가능한 아키텍처·설정·패턴을 정리한 문서입니다.
새 프로젝트 시작 시 이 파일을 기준으로 복제하세요.

---

## 1. 기술 스택

| 항목 | 버전 / 선택 |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Backend / Auth / DB | Supabase (`@supabase/ssr` 0.9, `@supabase/supabase-js` 2) |
| React | 19 |
| Font | Geist Sans / Geist Mono (next/font/google) |

### package.json 핵심 의존성

```json
"dependencies": {
  "@supabase/ssr": "^0.9.0",
  "@supabase/supabase-js": "^2.99.0",
  "next": "16.1.6",
  "react": "19.2.3",
  "react-dom": "19.2.3"
},
"devDependencies": {
  "@tailwindcss/postcss": "^4",
  "tailwindcss": "^4",
  "typescript": "^5",
  "eslint": "^9",
  "eslint-config-next": "16.1.6",
  "babel-plugin-react-compiler": "1.0.0"
}
```

---

## 2. 프로젝트 구조

```
src/
├── app/
│   ├── layout.tsx              # RootLayout — Geist 폰트, globals.css
│   ├── page.tsx                # 로그인 페이지 (LoginForm 렌더)
│   ├── signup/
│   │   ├── page.tsx            # 회원가입 페이지
│   │   └── verify/page.tsx     # 이메일 인증 대기 안내
│   ├── dashboard/
│   │   └── page.tsx            # 대시보드 (서버 컴포넌트 — 유저 정보 fetch 후 DashboardShell 전달)
│   └── auth/
│       └── callback/route.ts   # OAuth 코드 교환 + 이메일 OTP 인증 처리
│
├── components/
│   ├── LoginForm.tsx           # 이메일/비밀번호 + Google OAuth 로그인
│   ├── SignupForm.tsx          # 이름·학교·과목·비밀번호·이메일 회원가입
│   └── dashboard/
│       ├── DashboardShell.tsx  # View 상태 관리 — Sidebar + ProjectGrid 조합
│       ├── Sidebar.tsx         # 좌측 네비게이션 + 프로필 영역
│       ├── ProjectGrid.tsx     # 메인 콘텐츠 그리드 (뷰 필터·드래그·컨텍스트 메뉴)
│       └── ProfilePanel.tsx    # 프로필 수정 모달 (이름·학교·과목)
│
└── lib/
    └── supabase/
        ├── client.ts           # 브라우저용 Supabase 클라이언트
        └── server.ts           # 서버 컴포넌트용 Supabase 클라이언트 (쿠키 기반)
```

---

## 3. 환경 변수

`.env.local` 에 아래 두 값 필수:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 4. Supabase 클라이언트 패턴

### 브라우저 (Client Component)
```ts
// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### 서버 (Server Component / Route Handler)
```ts
// src/lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

---

## 5. 인증 흐름

```
[로그인 / 회원가입]
        │
        ├─ 이메일 + 비밀번호  → signInWithPassword / signUp
        │                        → router.push("/dashboard")
        │
        └─ Google OAuth       → signInWithOAuth({ provider: "google",
                                   redirectTo: "/auth/callback" })
                                       │
                               [GET /auth/callback]
                                       │
                               exchangeCodeForSession(code)
                                       │
                               redirect → /dashboard
```

- **이메일 인증 링크** 처리: `token_hash + type` → `verifyOtp()` → `/dashboard`
- **에러** 시: `/?error=auth` 로 리다이렉트

---

## 6. 대시보드 아키텍처

### 뷰(View) 타입

```ts
type View = "recent" | "all" | "mine" | "shared" | "ongoing" | "ended" | "trash";
```

### 컴포넌트 계층

```
dashboard/page.tsx          ← 서버: getUser() → profile 객체 생성
  └─ DashboardShell         ← 클라이언트: view 상태 관리
       ├─ Sidebar            ← 뷰 전환 네비게이션 + 프로필 버튼
       │    └─ ProfilePanel  ← 프로필 수정 모달 (조건부 렌더)
       └─ ProjectGrid        ← 뷰별 필터링·카드 렌더·인터랙션 전담
```

### UserProfile 타입

```ts
type UserProfile = {
  id: string;
  email: string;
  display_name: string | null;
  school: string | null;
  subject: string | null;
  avatar_url: string | null;
};
```

---

## 7. ProjectGrid 핵심 패턴

### Item 타입

```ts
type Item = {
  id: string;
  type: "folder" | "lesson";
  title: string;
  updatedAt: string;          // "YYYY-MM-DD"
  subject?: string;
  parentId: string | null;
  ownerId: string;
  lastAccessedAt?: string;
  deletedAt?: string | null;  // null = 활성, 날짜 = 휴지통
  status?: "ongoing" | "ended" | null;
  bookmarked?: boolean;
};
```

### 뷰별 필터 규칙

| View | 필터 조건 |
|---|---|
| recent | `lastAccessedAt >= 7일 전` (최신순) |
| all | `parentId === currentFolderId` (폴더 탐색) |
| mine | `ownerId === userId` |
| shared | `ownerId !== userId` |
| ongoing | `type === "lesson" && status === "ongoing"` |
| ended | `type === "lesson" && status === "ended"` |
| trash | `deletedAt !== null` |

모든 뷰에서 `deletedAt`이 있는 항목은 활성 뷰에서 제외 (`activeItems` 필터 공통 적용).

### 삭제 방식 — Soft Delete

- 삭제 = `deletedAt`에 오늘 날짜 기록 (휴지통 이동)
- 영구 삭제 = `items` 배열에서 완전 제거
- 복원 = `deletedAt: null`로 초기화

---

## 8. UI 패턴

### 모달 (공통 구조)
```tsx
// 배경 클릭으로 닫기
<div
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
  onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
>
  <div className="w-80 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
    {/* 내용 */}
  </div>
</div>
```
- `Escape` 키 닫기: `useEffect`로 `keydown` 이벤트 등록
- z-index: 모달 `z-50`, 컨텍스트 메뉴 `z-50` (position: fixed)

### 컨텍스트 메뉴 (우클릭)
- `onContextMenu` → `e.preventDefault()` → `{ itemId, x, y }` 상태 저장
- `position: fixed` + `top/left = e.clientY/clientX`
- 외부 클릭(`mousedown`) + `Escape` 로 닫기
- 현재 액션: **북마크 토글**, **삭제하기(→ 확인 모달)**

### 색상 / 디자인 토큰
| 용도 | 색상 |
|---|---|
| 브랜드 (primary) | `indigo-600` |
| 폴더 | `amber-300 ~ amber-400` |
| 위험 / 삭제 | `red-500` |
| 배경 | `gray-50` |
| 카드 | `white` + `gray-200` 보더 |
| 텍스트 기본 | `gray-900` |
| 텍스트 보조 | `gray-400 ~ gray-500` |

### 드래그 앤 드롭 (all 뷰 전용)
- `draggable` + `onDragStart/End/Over/Leave/Drop`
- 폴더로 드롭 → `parentId` 변경
- 상위 폴더 드롭존 (현재 폴더 안에서 드래그 중일 때 상단 표시)
- 자기 자신 / 자손 폴더로 이동 방지 로직 (`isDescendant`)

---

## 9. 새 프로젝트 시작 체크리스트

```
□ npx create-next-app@latest --typescript --tailwind --app
□ npm install @supabase/ssr @supabase/supabase-js
□ .env.local 에 Supabase URL / ANON_KEY 설정
□ Supabase 대시보드 → Authentication → Providers → Google 활성화
□ Supabase → URL Configuration → Redirect URL 에 /auth/callback 추가
□ src/lib/supabase/client.ts + server.ts 복사
□ src/app/auth/callback/route.ts 복사
□ UserProfile 타입 정의 (ProfilePanel.tsx 기준)
□ DashboardShell → Sidebar → ProjectGrid 계층 복사 후 도메인 맞게 수정
```
