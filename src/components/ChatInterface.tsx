'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import MessageBubble, { type Message } from './MessageBubble';
import { buildChatPayload } from '@/lib/chat/trimPayload';

interface PageContext {
  projectTitle: string;
  activePhase: string;
  activeSection: string;
  activityInputs: Record<string, string>;
  selectedActivityCode?: string;
  referenceFiles?: { name: string; mime: string; content?: string; pdfData?: string }[];
  selectedStandards?: { code: string; subject: string; domain: string; content: string }[];
  selectedIdeas?: { id: string; subject: string; domain: string; content: string }[];
  opinions?: { activityCode: string; question: string; responses: { name: string; text: string }[] }[];
}

interface Props {
  stage: string;
  onReady?: () => void;
  pageContext?: PageContext;
  lessonId?: string;
  userId?: string;
  triggerMessage?: string; // auto-sends when changed
}

function nowTimestamp() {
  const d = new Date();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h >= 12 ? '오후' : '오전'} ${h > 12 ? h - 12 : h === 0 ? 12 : h}:${m}`;
}

export default function ChatInterface({ stage, onReady, pageContext, lessonId, userId, triggerMessage }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // auth UID를 ref로 캐시 — 소유자/참여자 모두 동일하게 auth.uid() 사용
  const authUidRef = useRef<string | null>(null);
  // triggerMessage auto-send
  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => {});
  const lastTriggerRef = useRef<string>('');

  // 마운트 시: auth UID 캐시 + API 연결 확인
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) authUidRef.current = data.user.id;
    });
    fetch('/api/chat')
      .then((r) => r.ok && onReady?.())
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // textarea 높이 자동 조절
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const isInitialLoad = useRef(true);

  // stage별 메시지 캐시 — 이미 로드한 stage는 DB 재요청 없이 즉시 복원
  const msgCache = useRef<Map<string, { messages: Message[]; timestamps: string[] }>>(new Map());

  // userId를 ref로 유지 — stage 의존성에서 제외해 불필요한 재로드 방지
  const userIdRef = useRef(userId);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  // 단계 전환 시 캐시 우선, 없으면 DB 로드
  useEffect(() => {
    if (!lessonId) {
      setMessages([]);
      setTimestamps([]);
      return;
    }
    isInitialLoad.current = true;

    // 캐시 히트 → 즉시 복원, DB 요청 없음
    const cached = msgCache.current.get(stage);
    if (cached) {
      setMessages(cached.messages);
      setTimestamps(cached.timestamps);
      return;
    }

    setMessages([]);
    setTimestamps([]);
    setIsLoadingHistory(true);
    const load = async () => {
      try {
        const uid = userIdRef.current || authUidRef.current || (await createClient().auth.getUser().then(({ data }) => {
          if (data.user) { authUidRef.current = data.user.id; userIdRef.current = data.user.id; }
          return data.user?.id ?? null;
        }));
        if (!uid) return;
        const { data } = await createClient()
          .from('ai_messages')
          .select('role, content, created_at')
          .eq('lesson_id', lessonId)
          .eq('user_id', uid)
          .eq('context_activity_code', stage)
          .order('created_at', { ascending: true });
        if (!data) return;
        const msgs = data.map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
        const tss = data.map((r) => {
          const d = new Date(r.created_at);
          const h = d.getHours();
          const m = String(d.getMinutes()).padStart(2, '0');
          return `${h >= 12 ? '오후' : '오전'} ${h > 12 ? h - 12 : h === 0 ? 12 : h}:${m}`;
        });
        msgCache.current.set(stage, { messages: msgs, timestamps: tss });
        setMessages(msgs);
        setTimestamps(tss);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    load();
  // userId는 ref로 처리하므로 의존성에서 제외
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, lessonId]);

  useEffect(() => {
    // messages가 빈 상태(DB 로드 전)에서 초기 플래그를 소비하지 않도록 스킵
    if (messages.length === 0) return;
    if (isInitialLoad.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
      isInitialLoad.current = false;
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    const newTimestamps = [...timestamps, nowTimestamp()];
    setMessages(newMessages);
    setTimestamps(newTimestamps);
    setInput('');

    const assistantPlaceholder: Message = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantPlaceholder]);
    setTimestamps([...newTimestamps, nowTimestamp()]);
    setIsStreaming(true);

    abortRef.current = new AbortController();

    // 사용자 메시지 DB 저장 (authUidRef 우선, 없으면 prop userId)
    const saveUid = authUidRef.current || userId;
    if (lessonId && saveUid) {
      createClient().from('ai_messages').insert({
        lesson_id: lessonId,
        user_id: saveUid,
        role: 'user',
        content: text.trim(),
        context_activity_code: stage,
      }).then(({ error }) => {
        if (error) console.error('[ai_messages] user insert error:', error.message);
      });
    }

    try {
      // PDF 파일이 있으면 마지막 유저 메시지에 document 블록 삽입
      const pdfs = (pageContext?.referenceFiles ?? []).filter((f) => f.pdfData);
      const apiMessages = newMessages.map((m, idx) => {
        if (idx === newMessages.length - 1 && m.role === 'user' && pdfs.length > 0) {
          return {
            role: m.role,
            content: [
              ...pdfs.map((f) => ({
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: f.pdfData },
              })),
              { type: 'text', text: m.content },
            ],
          };
        }
        return m;
      });

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildChatPayload({ messages: apiMessages, stage, pageContext })),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: accumulated };
          return updated;
        });
      }

      // 스트리밍 완료 후 캐시 업데이트
      setMessages((prev) => {
        msgCache.current.set(stage, { messages: prev, timestamps: [...newTimestamps, nowTimestamp()] });
        return prev;
      });

      // AI 응답 DB 저장 (스트리밍 완료 후)
      if (lessonId && saveUid && accumulated) {
        createClient().from('ai_messages').insert({
          lesson_id: lessonId,
          user_id: saveUid,
          role: 'assistant',
          content: accumulated,
          context_activity_code: stage,
        }).then(({ error }) => {
          if (error) console.error('[ai_messages] assistant insert error:', error.message);
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;

      setMessages((prev) => {
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
  };

  // keep ref up-to-date so triggerMessage effect always calls latest sendMessage
  sendMessageRef.current = sendMessage;

  // auto-send when triggerMessage changes
  useEffect(() => {
    if (!triggerMessage || triggerMessage === lastTriggerRef.current) return;
    lastTriggerRef.current = triggerMessage;
    const t = setTimeout(() => sendMessageRef.current(triggerMessage), 120);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoadingHistory ? (
          <div className="flex flex-col gap-3 pt-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`flex gap-2 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
                <div className="h-7 w-7 shrink-0 rounded-full bg-gray-100 animate-pulse" />
                <div className={`h-10 rounded-2xl bg-gray-100 animate-pulse ${i % 2 === 0 ? 'w-3/4' : 'w-1/2'}`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#5044e3] to-[#44c4b8] text-xs font-bold text-white">
              M
            </div>
            <p className="text-sm font-semibold text-[#2d3339]">Minerva AI</p>
            <p className="text-sm text-[#757b82]">무엇이든 질문해 보세요.</p>
          </div>
        ) : null}
        {messages.map((msg, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const isFirst = !prev || prev.role !== msg.role;
          const isLast = !next || next.role !== msg.role;
          return (
            <MessageBubble
              key={i}
              message={msg}
              isFirst={isFirst}
              isLast={isLast}
              timestamp={timestamps[i] ?? ''}
              isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="bg-white px-4 pt-2 pb-5" style={{ borderTop: "1px solid rgba(173,178,186,0.2)" }}>
        <div className="relative flex items-center">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            rows={1}
            disabled={isStreaming}
            className="w-full resize-none rounded-full bg-[#f1f4f9] pl-5 pr-12 py-3 text-[15px] text-[#2d3339] placeholder-[#adb2ba] outline-none border-none disabled:opacity-50 min-h-[48px] focus:ring-2 focus:ring-[#5044e3]/20"
          />
          {isStreaming && (
            <button
              onClick={() => abortRef.current?.abort()}
              className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-400 text-white transition hover:bg-red-500"
              title="중단"
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            </button>
          )}
          {!isStreaming && input.trim() && (
            <button
              onClick={() => sendMessage(input)}
              className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#5044e3] to-[#44c4b8] text-white transition hover:opacity-90"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
