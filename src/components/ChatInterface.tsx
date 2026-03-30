'use client';

import { useState, useRef, useEffect } from 'react';
import MessageBubble, { type Message } from './MessageBubble';

interface PageContext {
  projectTitle: string;
  activePhase: string;
  activeSection: string;
  activityInputs: Record<string, string>;
}

interface Props {
  stage: string;
  onReady?: () => void;
  pageContext?: PageContext;
}

function nowTimestamp() {
  const d = new Date();
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h >= 12 ? '오후' : '오전'} ${h > 12 ? h - 12 : h === 0 ? 12 : h}:${m}`;
}

export default function ChatInterface({ stage, onReady, pageContext }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // API 연결 확인 (마운트 시 1회)
  useEffect(() => {
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

  // 단계 전환 시 대화 초기화
  useEffect(() => {
    setMessages([]);
    setTimestamps([]);
  }, [stage]);

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

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, stage, pageContext }),
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
    <div className="flex flex-col h-full bg-[#EEF2F8]">
      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2C3F5A] text-xs font-bold text-white">
              M
            </div>
            <p className="text-sm font-semibold text-[#3A4560]">Minerva</p>
            <p className="text-sm text-[#9AAAC0]">무엇이든 질문해 보세요.</p>
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
      <div className="bg-[#EEF2F8] px-3 pt-2 pb-5">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            rows={1}
            disabled={isStreaming}
            className="w-full resize-none rounded-2xl bg-[#D8E3EF] pl-4 pr-11 py-3 text-[15px] text-[#2C3A52] placeholder-[#9AAAC0] outline-none border-none disabled:opacity-50 min-h-[48px]"
          />
          {isStreaming && (
            <button
              onClick={() => abortRef.current?.abort()}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-red-400 text-white transition hover:bg-red-500"
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
              className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-[#2C3F5A] text-white transition hover:bg-[#3D5A7A]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
