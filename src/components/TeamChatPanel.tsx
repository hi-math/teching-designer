'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

const EMOJIS = ['👍', '❤️', '😄', '😮', '😢'];

// ─── 타입 ──────────────────────────────────────────────────────────

interface Reaction {
  count: number;
  reactedByMe: boolean;
}

interface ReplyRef {
  id: string;
  userId: string;
  senderName: string;
  content: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  senderName: string;
  avatarUrl: string | null;
  content: string;
  timestamp: string;
  reactions: Record<string, Reaction>;
  replyTo?: ReplyRef;
}

// ─── 유틸 ──────────────────────────────────────────────────────────

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h >= 12 ? '오후' : '오전'} ${h > 12 ? h - 12 : h === 0 ? 12 : h}:${m}`;
}

function initials(name: string) {
  return name.charAt(0);
}

const AVATAR_COLORS = [
  'bg-[#3D5A7A]', 'bg-[#4A7A5A]', 'bg-[#7A5A3D]',
  'bg-[#5A3D7A]', 'bg-[#7A3D5A]', 'bg-[#3D7A6A]',
];
function avatarColor(userId: string) {
  let n = 0;
  for (let i = 0; i < userId.length; i++) n += userId.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

// ─── 컴포넌트 ──────────────────────────────────────────────────────

interface Props {
  lessonId: string;
  currentUserId: string;
}

export default function TeamChatPanel({ lessonId, currentUserId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // ── 프로필 캐시 ──────────────────────────────────────────────
  const profileCache = useRef<Record<string, { name: string; avatarUrl: string | null }>>({});

  const getProfile = useCallback(async (userId: string) => {
    if (profileCache.current[userId]) return profileCache.current[userId];
    const { data } = await createClient()
      .from('profiles')
      .select('display_name, email, avatar_url')
      .eq('id', userId)
      .single();
    const profile = {
      name: data?.display_name ?? data?.email ?? '알 수 없음',
      avatarUrl: data?.avatar_url ?? null,
    };
    profileCache.current[userId] = profile;
    return profile;
  }, []);

  // ── DB 메시지 → ChatMessage 변환 ──────────────────────────────
  const toMessage = useCallback(async (
    row: { id: string; user_id: string; content: string; created_at: string; reply_to: string | null },
    allRows: typeof row[]
  ): Promise<ChatMessage> => {
    const profile = await getProfile(row.user_id);
    let replyRef: ReplyRef | undefined;
    if (row.reply_to) {
      const parent = allRows.find((r) => r.id === row.reply_to);
      if (parent) {
        const parentProfile = await getProfile(parent.user_id);
        replyRef = {
          id: parent.id,
          userId: parent.user_id,
          senderName: parentProfile.name,
          content: parent.content,
        };
      }
    }
    return {
      id: row.id,
      userId: row.user_id,
      senderName: profile.name,
      avatarUrl: profile.avatarUrl,
      content: row.content,
      timestamp: formatTimestamp(row.created_at),
      reactions: {},
      replyTo: replyRef,
    };
  }, [getProfile]);

  // ── 초기 로드 ────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('team_messages')
        .select('id, user_id, content, created_at, reply_to')
        .eq('lesson_id', lessonId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
        .limit(200);
      if (!data) return;
      const converted = await Promise.all(data.map((row) => toMessage(row, data)));

      const ids = converted.map((m) => m.id);
      if (ids.length > 0) {
        const { data: rdata } = await supabase
          .from('team_message_reactions')
          .select('message_id, user_id, emoji')
          .in('message_id', ids);
        if (rdata) {
          const rmap: Record<string, Record<string, Reaction>> = {};
          for (const r of rdata) {
            if (!rmap[r.message_id]) rmap[r.message_id] = {};
            const ex = rmap[r.message_id][r.emoji];
            rmap[r.message_id][r.emoji] = {
              count: (ex?.count ?? 0) + 1,
              reactedByMe: (ex?.reactedByMe ?? false) || r.user_id === currentUserId,
            };
          }
          setMessages(converted.map((m) => ({ ...m, reactions: rmap[m.id] ?? {} })));
          return;
        }
      }
      setMessages(converted);
    };
    load();
  }, [lessonId, toMessage, currentUserId]);

  // ── Realtime 구독 ────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`team_messages:${lessonId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_messages' },
        async (payload) => {
          const row = payload.new as { id: string; lesson_id: string; user_id: string; content: string; created_at: string; reply_to: string | null };
          if (row.lesson_id !== lessonId) return;
          if (row.user_id === currentUserId) return;
          const msg = await toMessage(row, [row]);
          setMessages((prev) => [...prev, msg]);
        }
      )
      .subscribe((status, err) => {
        console.log('[Chat Realtime]', status, err ?? '');
      });
    return () => { supabase.removeChannel(channel); };
  }, [lessonId, currentUserId, toMessage]);

  // ── 리액션 Realtime ──────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`team_reactions:${lessonId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_message_reactions' },
        (payload) => {
          const row = payload.new as { message_id: string; user_id: string; emoji: string };
          if (row.user_id === currentUserId) return;
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== row.message_id) return msg;
              const ex = msg.reactions[row.emoji];
              return { ...msg, reactions: { ...msg.reactions, [row.emoji]: { count: (ex?.count ?? 0) + 1, reactedByMe: ex?.reactedByMe ?? false } } };
            })
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'team_message_reactions' },
        (payload) => {
          const row = payload.old as { message_id?: string; user_id?: string; emoji?: string };
          if (!row.message_id || !row.emoji) return;
          if (row.user_id === currentUserId) return;
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== row.message_id) return msg;
              const ex = msg.reactions[row.emoji!];
              if (!ex) return msg;
              const updated = { ...msg.reactions };
              if (ex.count <= 1) delete updated[row.emoji!];
              else updated[row.emoji!] = { count: ex.count - 1, reactedByMe: ex.reactedByMe };
              return { ...msg, reactions: updated };
            })
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [lessonId, currentUserId]);

  // ── 자동 스크롤 ──────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── textarea 자동 높이 ───────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  // ── 이모지 피커 외부 클릭 닫기 ──────────────────────────────
  useEffect(() => {
    if (!reactionPickerFor) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setReactionPickerFor(null);
        setPickerPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [reactionPickerFor]);

  // ── 답장 대상 메시지로 스크롤 ────────────────────────────────
  const scrollToMessage = useCallback((msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedId(msgId);
    setTimeout(() => setHighlightedId(null), 1500);
  }, []);

  // ── 메시지 전송 ──────────────────────────────────────────────
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);

    const now = new Date().toISOString();
    const profile = await getProfile(currentUserId);

    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      userId: currentUserId,
      senderName: profile.name,
      avatarUrl: profile.avatarUrl,
      content: text,
      timestamp: formatTimestamp(now),
      reactions: {},
      replyTo: replyTo
        ? { id: replyTo.id, userId: replyTo.userId, senderName: replyTo.senderName, content: replyTo.content }
        : undefined,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput('');
    setReplyTo(null);

    const { data, error } = await createClient()
      .from('team_messages')
      .insert({
        lesson_id: lessonId,
        user_id: currentUserId,
        content: text,
        reply_to: replyTo?.id ?? null,
      })
      .select('id')
      .single();

    setSending(false);

    if (!error && data) {
      setMessages((prev) =>
        prev.map((m) => m.id === tempId ? { ...m, id: data.id } : m)
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── 반응 토글 ──────────────────────────────────────────────
  const toggleReaction = async (messageId: string, emoji: string) => {
    const msg = messages.find((m) => m.id === messageId);
    const alreadyReacted = !!msg?.reactions[emoji]?.reactedByMe;

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const existing = m.reactions[emoji];
        const updated = { ...m.reactions };
        if (alreadyReacted) {
          if ((existing?.count ?? 0) <= 1) delete updated[emoji];
          else updated[emoji] = { count: existing!.count - 1, reactedByMe: false };
        } else {
          updated[emoji] = { count: (existing?.count ?? 0) + 1, reactedByMe: true };
        }
        return { ...m, reactions: updated };
      })
    );
    setReactionPickerFor(null);
    setPickerPos(null);

    const supabase = createClient();
    if (alreadyReacted) {
      await supabase.from('team_message_reactions').delete()
        .eq('message_id', messageId).eq('user_id', currentUserId).eq('emoji', emoji);
    } else {
      await supabase.from('team_message_reactions')
        .insert({ message_id: messageId, user_id: currentUserId, emoji });
    }
  };

  const openPicker = (e: React.MouseEvent<HTMLButtonElement>, msgId: string) => {
    if (reactionPickerFor === msgId) {
      setReactionPickerFor(null);
      setPickerPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setPickerPos({ top: rect.top - 48, left: rect.left - 100 });
    setReactionPickerFor(msgId);
  };

  // ── 공통 액션 버튼 ──────────────────────────────────────────
  const EmojiBtn = ({ msgId, e }: { msgId: string; e: React.MouseEvent<HTMLButtonElement> | null }) => null;
  void EmojiBtn;

  // ── 렌더 ────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-white">

      {/* 이모지 피커 — fixed */}
      {reactionPickerFor && pickerPos && (
        <div
          ref={pickerRef}
          className="fixed flex gap-1.5 rounded-2xl bg-white border border-[#E2E8F4] shadow-lg px-3 py-2 z-50"
          style={{ top: pickerPos.top, left: pickerPos.left }}
        >
          {EMOJIS.map((e) => (
            <button
              key={e}
              onMouseDown={(ev) => { ev.preventDefault(); toggleReaction(reactionPickerFor, e); }}
              className="text-xl hover:scale-125 transition-transform leading-none"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* 메시지 목록 */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-3 py-4"
        onClick={() => setReplyTo(null)}
      >
        {messages.map((msg, i) => {
          const isMe = msg.userId === currentUserId;
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const isFirst = !prev || prev.userId !== msg.userId;
          const isLast  = !next || next.userId !== msg.userId;
          const hasReactions = Object.keys(msg.reactions).length > 0;
          const isHovered  = hoveredId === msg.id;
          const isHighlighted = highlightedId === msg.id;
          const color = avatarColor(msg.userId);

          void isLast;

          /* ── 내 메시지 (오른쪽) ── */
          if (isMe) {
            return (
              <div
                id={`msg-${msg.id}`}
                key={msg.id}
                className={`${isFirst ? 'mt-3' : 'mt-0.5'} rounded-xl transition-colors duration-300 ${isHighlighted ? 'bg-indigo-50' : ''}`}
                onMouseEnter={() => setHoveredId(msg.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="flex justify-end items-end gap-1.5 pr-1">
                  {/* 답장 버튼 — 왼쪽 끝 */}
                  {isHovered && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setReplyTo(msg); textareaRef.current?.focus(); }}
                      title="답장"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-[#E2E8F4] shadow-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600 shrink-0 self-end mb-1"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                  )}
                  <span className="shrink-0 text-xs text-[#9AAAC0] self-end mb-1">{msg.timestamp}</span>
                  {/* 이모지 버튼 — 버블 바로 왼쪽 */}
                  {isHovered && (
                    <button
                      onClick={(e) => openPicker(e, msg.id)}
                      title="반응 추가"
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-[#E2E8F4] text-[14px] shadow-sm hover:bg-gray-50 shrink-0 self-end mb-1"
                    >🙂</button>
                  )}
                  <div className="max-w-[70%]">
                    {msg.replyTo && (
                      <button
                        onClick={(e) => { e.stopPropagation(); scrollToMessage(msg.replyTo!.id); }}
                        className="mb-1 w-full text-left rounded-xl rounded-tr-sm bg-[#ede9fb] border-l-[3px] border-[#5044e3] px-3 py-1.5 hover:bg-[#e4dff8] transition-colors cursor-pointer"
                      >
                        <p className="text-[12px] font-semibold text-[#5044e3]">{msg.replyTo.senderName}의 메시지</p>
                        <p className="text-[13px] text-[#7c72d6] truncate">{msg.replyTo.content}</p>
                      </button>
                    )}
                    <div className="rounded-2xl rounded-tr-sm bg-[#5044e3] px-4 py-2.5 text-[16px] leading-relaxed text-white">
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    {hasReactions && (
                      <div className="mt-1 flex flex-wrap justify-end gap-1">
                        {Object.entries(msg.reactions).map(([emoji, data]) => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[13px] border transition-colors ${
                              data.reactedByMe ? 'bg-[#D4E4F4] border-[#6E8EAA] text-[#2E5068]' : 'bg-white border-[#E2E8F4] text-gray-500 hover:bg-gray-50'
                            }`}
                          >{emoji} <span>{data.count}</span></button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          /* ── 팀원 메시지 (왼쪽) ── */
          return (
            <div
              id={`msg-${msg.id}`}
              key={msg.id}
              className={`${isFirst ? 'mt-3' : 'mt-0.5'} rounded-xl transition-colors duration-300 ${isHighlighted ? 'bg-indigo-50' : ''}`}
              onMouseEnter={() => setHoveredId(msg.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="flex items-start gap-2 pl-1">
                <div className="w-9 shrink-0">
                  {isFirst ? (
                    msg.avatarUrl ? (
                      <img src={msg.avatarUrl} alt={msg.senderName} className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${color} text-[14px] font-bold text-white`}>
                        {initials(msg.senderName)}
                      </div>
                    )
                  ) : (
                    <div className="w-9 h-9" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {isFirst && (
                    <p className="mb-1.5 text-[14px] font-semibold text-[#3A4560]">{msg.senderName}</p>
                  )}
                  <div className="flex items-end gap-1.5">
                    <div className="max-w-[70%]">
                      {msg.replyTo && (
                        <button
                          onClick={(e) => { e.stopPropagation(); scrollToMessage(msg.replyTo!.id); }}
                          className="mb-1 w-full text-left rounded-xl rounded-tl-sm border-l-[3px] border-[#a0aec0] bg-[#f0f4f9] px-3 py-1.5 hover:bg-[#e6edf5] transition-colors cursor-pointer"
                        >
                          <p className="text-[12px] font-semibold text-[#5a6a88]">{msg.replyTo.senderName}의 메시지</p>
                          <p className="text-[13px] text-[#7a8aa8] truncate">{msg.replyTo.content}</p>
                        </button>
                      )}
                      <div className="rounded-2xl rounded-tl-sm bg-[#e9eaec] px-4 py-2.5 text-[16px] leading-relaxed text-[#2d3339]">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      {hasReactions && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {Object.entries(msg.reactions).map(([emoji, data]) => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(msg.id, emoji)}
                              className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[13px] border transition-colors ${
                                data.reactedByMe ? 'bg-[#D4E4F4] border-[#6E8EAA] text-[#2E5068]' : 'bg-white border-[#E2E8F4] text-gray-500 hover:bg-gray-50'
                              }`}
                            >{emoji} <span>{data.count}</span></button>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* 이모지 버튼 — 버블 바로 오른쪽 */}
                    {isHovered && (
                      <button
                        onClick={(e) => openPicker(e, msg.id)}
                        title="반응 추가"
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-[#E2E8F4] text-[14px] shadow-sm hover:bg-gray-50 shrink-0 self-end mb-1"
                      >🙂</button>
                    )}
                    <span className="shrink-0 text-xs text-[#B0BEDA] self-end mb-1">{msg.timestamp}</span>
                    {/* 답장 버튼 — 오른쪽 끝 */}
                    {isHovered && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setReplyTo(msg); textareaRef.current?.focus(); }}
                        title="답장"
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-[#E2E8F4] shadow-sm text-gray-400 hover:bg-gray-50 hover:text-gray-600 shrink-0 self-end mb-1"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 답장 미리보기 */}
      {replyTo && (
        <div className="shrink-0 bg-white px-4 pt-2 pb-0 flex items-center gap-2">
          <div className="flex-1 min-w-0 rounded-xl bg-[#f0f2ff] border-l-[3px] border-[#5044e3] px-3 py-1.5">
            <p className="text-[13px] font-semibold text-[#5044e3]">{replyTo.senderName}에게 답장</p>
            <p className="text-[13px] text-[#7c72d6] truncate">{replyTo.content}</p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            className="shrink-0 rounded-full p-1 text-[#9AAAC0] hover:text-[#3A4560]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

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
            className="w-full resize-none rounded-full bg-[#f1f4f9] pl-5 pr-12 py-3 text-[15px] text-[#2d3339] placeholder-[#adb2ba] outline-none border-none min-h-[48px] focus:ring-2 focus:ring-[#5044e3]/20"
          />
          {input.trim() && (
            <button
              onClick={sendMessage}
              disabled={sending}
              className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#5044e3] to-[#4335d6] text-white transition hover:opacity-90 disabled:opacity-50"
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
