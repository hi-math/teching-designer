'use client';

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import MessageBubble, { type Message } from './MessageBubble';

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
}

function nowTimestamp() {
  const d = new Date();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h >= 12 ? '오후' : '오전'} ${h > 12 ? h - 12 : h === 0 ? 12 : h}:${m}`;
}

export default function ChatInterface({ stage, onReady, pageContext, lessonId, userId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // auth UID를 ref로 캐시 — 소유자/참여자 모두 동일하게 auth.uid() 사용
  const authUidRef = useRef<string | null>(null);

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

  // 단계 전환 시 DB에서 대화 기록 로드
  useEffect(() => {
    if (!lessonId) {
      setMessages([]);
      setTimestamps([]);
      return;
    }
    const load = async () => {
      const loadUid = authUidRef.current || userId;
      if (!loadUid) return;
      const { data } = await createClient()
        .from('ai_messages')
        .select('role, content, created_at')
        .eq('lesson_id', lessonId)
        .eq('user_id', loadUid)
        .eq('context_activity_code', stage)
        .order('created_at', { ascending: true });
      if (!data) return;
      setMessages(data.map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content })));
      setTimestamps(data.map((r) => {
        const d = new Date(r.created_at);
        const h = d.getHours();
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${h >= 12 ? '오후' : '오전'} ${h > 12 ? h - 12 : h === 0 ? 12 : h}:${m}`;
      }));
    };
    load();
  }, [stage, lessonId, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        body: JSON.stringify({ messages: apiMessages, stage, pageContext }),
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
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#5044e3] to-[#6c63ff] text-xs font-bold text-white">
              M
            </div>
            <p className="text-sm font-semibold text-[#2d3339]">Minerva AI</p>
            <p className="text-sm text-[#757b82]">무엇이든 질문해 보세요.</p>
          </div>
        )}
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
              className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#5044e3] to-[#4335d6] text-white transition hover:opacity-90"
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
