# Minerva 채팅창 구현 명세

> **범위**: 채팅 인터페이스 컴포넌트 및 API 연동만 다룬다.  
> 레이아웃, 사이드바, 단계 네비게이션 등 나머지 UI는 별도 문서 참고.

---

## 1. 파일 구성.

```
app/
└── api/
    └── chat/
        └── route.ts          ← 서버: Anthropic API 스트리밍 엔드포인트

components/
├── ChatInterface.tsx          ← 채팅 컨테이너 (상태 관리, fetch)
└── MessageBubble.tsx          ← 개별 메시지 렌더링
```

---

## 2. API 라우트 (`app/api/chat/route.ts`)

### 역할
- 클라이언트에서 받은 메시지 배열을 Anthropic API로 전달
- 스트리밍 응답을 그대로 클라이언트에 흘려보냄
- `web_search` 도구 포함

### 요청 형식
```ts
POST /api/chat
Content-Type: application/json

{
  messages: { role: 'user' | 'assistant', content: string }[],
  stage: 'T' | 'A' | 'Ds' | 'DI' | 'E'   // 현재 설계 단계
}
```

### 구현
```ts
import Anthropic from '@anthropic-ai/sdk';
import { loadSystemPrompt } from '@/lib/prompts';   // prompts/*.md 파일 로더

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const { messages, stage = 'T' } = await req.json();
  const systemPrompt = loadSystemPrompt(stage);

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: systemPrompt,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',     // Nginx 버퍼링 방지
    },
  });
}
```

### 핵심 포인트
- `web_search` 도구 결과는 모델이 자동으로 컨텍스트에 포함시킨다. 클라이언트에서 별도 처리 불필요.
- `text_delta` 타입만 스트리밍한다. `tool_use` 블록은 무시해도 최종 텍스트에 반영된다.
- `system` 프롬프트는 `stage` 값에 따라 `prompts/` 폴더에서 동적으로 로드한다.

---

## 3. 타입 정의

```ts
// 공통으로 사용할 메시지 타입
export interface Message {
  role: 'user' | 'assistant';
  content: string;
}
```

---

## 4. ChatInterface 컴포넌트 (`components/ChatInterface.tsx`)

### 상태
```ts
const [messages, setMessages]     = useState<Message[]>([]);
const [input, setInput]           = useState('');
const [isStreaming, setIsStreaming]= useState(false);
```

### 메시지 전송 함수
```ts
const sendMessage = async (text: string) => {
  if (!text.trim() || isStreaming) return;

  // 1. 사용자 메시지를 목록에 추가
  const userMsg: Message = { role: 'user', content: text.trim() };
  const newMessages = [...messages, userMsg];
  setMessages(newMessages);
  setInput('');

  // 2. 빈 assistant 메시지 자리 확보 (스트리밍 중 업데이트 대상)
  setMessages([...newMessages, { role: 'assistant', content: '' }]);
  setIsStreaming(true);

  // 3. 스트리밍 fetch
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: newMessages,   // API에는 빈 assistant 메시지 제외
      stage,
    }),
  });

  // 4. 청크를 읽으며 마지막 메시지에 누적
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    accumulated += decoder.decode(value, { stream: true });

    setMessages(prev => {
      const updated = [...prev];
      updated[updated.length - 1] = { role: 'assistant', content: accumulated };
      return updated;
    });
  }

  setIsStreaming(false);
};
```

### 입력창 처리
```ts
// Enter 전송 / Shift+Enter 줄바꿈
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(input);
  }
};
```

### 자동 스크롤
```ts
const bottomRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);

// JSX 메시지 목록 끝에:
<div ref={bottomRef} />
```

### JSX 구조
```tsx
<div className="flex flex-col h-full">
  {/* 메시지 목록 */}
  <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
    {messages.map((msg, i) => (
      <MessageBubble
        key={i}
        message={msg}
        isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
      />
    ))}
    <div ref={bottomRef} />
  </div>

  {/* 입력창 */}
  <div className="flex-shrink-0 border-t px-4 py-3 flex gap-2 items-end">
    <textarea
      value={input}
      onChange={e => setInput(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="메시지를 입력하세요… (Shift+Enter: 줄바꿈)"
      rows={1}
      disabled={isStreaming}
    />
    <button
      onClick={() => sendMessage(input)}
      disabled={!input.trim() || isStreaming}
    >
      전송
    </button>
  </div>
</div>
```

---

## 5. MessageBubble 컴포넌트 (`components/MessageBubble.tsx`)

### Props
```ts
interface Props {
  message: Message;
  isStreaming?: boolean;  // true면 로딩 점 애니메이션 표시
}
```

### 렌더링 규칙
- `role === 'user'`: 오른쪽 정렬
- `role === 'assistant'`: 왼쪽 정렬
- `isStreaming && content === ''`: 로딩 인디케이터 표시

### 로딩 인디케이터 예시
```tsx
{isStreaming && !message.content ? (
  <div className="flex gap-1">
    {[0, 1, 2].map(i => (
      <span
        key={i}
        className="w-2 h-2 rounded-full bg-current animate-bounce"
        style={{ animationDelay: `${i * 0.15}s` }}
      />
    ))}
  </div>
) : (
  <p>{message.content}</p>
)}
```

---

## 6. 에러 처리

```ts
try {
  // ... fetch 및 스트리밍 로직
} catch (err) {
  if (err instanceof Error && err.name === 'AbortError') return; // 취소는 무시

  // 마지막 메시지를 에러 메시지로 교체
  setMessages(prev => {
    const updated = [...prev];
    updated[updated.length - 1] = {
      role: 'assistant',
      content: '응답 중 오류가 발생했습니다. 다시 시도해 주세요.',
    };
    return updated;
  });
} finally {
  setIsStreaming(false);
}
```

### 중단(abort) 지원이 필요한 경우

```ts
const abortRef = useRef<AbortController | null>(null);

// 전송 시
abortRef.current = new AbortController();
const res = await fetch('/api/chat', {
  ...
  signal: abortRef.current.signal,
});

// 중단 버튼
<button onClick={() => abortRef.current?.abort()}>중단</button>
```

---

## 7. 단계(stage) 연동

상위 컴포넌트에서 `stage` prop을 받아 API 요청에 포함시킨다.  
단계가 바뀌면 대화 기록을 초기화하거나 별도로 보관할 수 있다.

```ts
// 단계 전환 시 이전 대화 보관 예시
const [stageHistory, setStageHistory] = useState<Record<string, Message[]>>({});

useEffect(() => {
  // 단계 전환 시 해당 단계의 기존 대화 복원
  setMessages(stageHistory[stage] ?? []);
}, [stage]);
```

---

## 8. 구현 체크리스트

- [ ] `ANTHROPIC_API_KEY` 환경변수 설정 (`.env.local`)
- [ ] `app/api/chat/route.ts` — 스트리밍 엔드포인트
- [ ] `components/MessageBubble.tsx` — 메시지 렌더링
- [ ] `components/ChatInterface.tsx` — 상태 관리 + fetch
- [ ] Enter 전송 / Shift+Enter 줄바꿈 동작 확인
- [ ] 스트리밍 도중 로딩 인디케이터 확인
- [ ] 에러 상황 fallback 메시지 확인
- [ ] 자동 스크롤 동작 확인
