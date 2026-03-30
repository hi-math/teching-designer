'use client';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  message: Message;
  isFirst: boolean;
  isLast: boolean;
  isStreaming?: boolean;
  timestamp: string;
}

export default function MessageBubble({ message, isFirst, isLast, isStreaming, timestamp }: Props) {
  const isUser = message.role === 'user';

  /* ── 사용자 메시지: 말풍선 ── */
  if (isUser) {
    return (
      <div className={`flex justify-end ${isFirst ? 'mt-4' : 'mt-1'}`}>
        <div className="flex max-w-[78%] flex-col items-end">
          <div className="flex items-end gap-1.5">
            {isLast && <span className="mb-0.5 shrink-0 text-xs text-[#9AAAC0]">{timestamp}</span>}
            <div className="rounded-2xl rounded-tr-sm bg-[#3D5A7A] px-4 py-3 text-base leading-relaxed text-white">
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── AI 메시지: 말풍선 없이 ── */
  return (
    <div className={`flex items-start gap-3 ${isFirst ? 'mt-4' : 'mt-2'}`}>
      <div className="w-7 shrink-0 pt-0.5">
        {isFirst && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2C3F5A] text-[11px] font-bold text-white">
            M
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        {isFirst && (
          <p className="mb-1.5 text-[13px] font-semibold text-[#3A4560]">Minerva</p>
        )}
        {isStreaming && !message.content ? (
          <div className="flex gap-1 py-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-[#9AAAC0] animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#2C3A52]">
            {message.content}
          </p>
        )}
        {isLast && <p className="mt-1.5 text-xs text-[#B0BEDA]">{timestamp}</p>}
      </div>
    </div>
  );
}
