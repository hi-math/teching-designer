'use client';

import { useState, useEffect, useRef } from 'react';

type EmailStatus = 'idle' | 'loading' | 'success' | 'not_found' | 'already_member' | 'self_invite' | 'invalid';

type MemberInfo = { id: string; name: string; email: string; avatarUrl: string | null };

export default function ShareModal({
  lessonId,
  members = [],
  onClose,
}: {
  lessonId: string;
  members?: MemberInfo[];
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle');
  const [invitedName, setInvitedName] = useState('');

  const [link, setLink] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkError, setLinkError] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  // ESC 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // 포커스
  useEffect(() => { inputRef.current?.focus(); }, []);

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const confirmEmail = async () => {
    if (!validateEmail(email)) {
      setEmailStatus('invalid');
      return;
    }
    setEmailStatus('loading');
    const res = await fetch(`/api/lessons/${lessonId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    if (res.ok) {
      const { displayName } = await res.json();
      setInvitedName(displayName);
      setEmailStatus('success');
      setEmail('');
    } else {
      const { error } = await res.json().catch(() => ({}));
      if (error === 'already_member') setEmailStatus('already_member');
      else if (error === 'self_invite') setEmailStatus('self_invite');
      else setEmailStatus('not_found');
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') confirmEmail();
    else if (emailStatus !== 'idle') setEmailStatus('idle');
  };

  const generateLink = async () => {
    setGenerating(true);
    setLinkError('');
    setLink('');
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId }),
    });
    setGenerating(false);
    if (!res.ok) { setLinkError('링크 생성 중 오류가 발생했습니다.'); return; }
    const { url } = await res.json();
    setLink(url);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusMessage: Record<EmailStatus, { text: string; color: string } | null> = {
    idle: null,
    loading: null,
    success: { text: `${invitedName}님을 멤버로 추가했습니다.`, color: 'text-green-600' },
    not_found: { text: '해당 이메일의 계정을 찾을 수 없습니다.', color: 'text-red-500' },
    already_member: { text: '이미 이 프로젝트의 멤버입니다.', color: 'text-amber-600' },
    self_invite: { text: '본인을 초대할 수 없습니다.', color: 'text-amber-600' },
    invalid: { text: '올바른 이메일 형식이 아닙니다.', color: 'text-red-500' },
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[480px] rounded-2xl bg-white shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5044e3] text-white">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <h2 className="text-[17px] font-semibold text-gray-900">프로젝트 공유</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 현재 공유 중인 멤버 */}
          {members.length > 0 && (
            <div>
              <p className="mb-2 text-[13px] font-medium text-[#757b82]">공유 중인 멤버 ({members.length})</p>
              <div className="space-y-2">
                {members.map((m, idx) => {
                  let n = 0; for (let i = 0; i < m.id.length; i++) n += m.id.charCodeAt(i);
                  const colors = ["bg-[#3D5A7A]","bg-[#4A7A5A]","bg-[#7A5A3D]","bg-[#5A3D7A]","bg-[#7A3D5A]"];
                  const color = colors[n % colors.length];
                  return (
                    <div key={m.id} className="flex items-center gap-3">
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt={m.name} className="h-8 w-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${color} text-[13px] font-bold text-white`}>
                          {m.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-[#2d3339]">
                          {m.name}{idx === 0 ? <span className="ml-1.5 text-[11px] font-normal text-[#adb2ba]">(소유자)</span> : null}
                        </p>
                        <p className="truncate text-[12px] text-[#757b82]">{m.email}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 구분선 */}
          {members.length > 0 && <div className="h-px bg-[#e2e5ea]" />}

          {/* 이메일로 직접 초대 */}
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-[#757b82]">
              이메일로 멤버 추가
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailStatus !== 'idle') setEmailStatus('idle'); }}
                onKeyDown={handleEmailKeyDown}
                placeholder="example@email.com"
                className={`flex-1 rounded-xl border px-4 py-2.5 text-[14px] text-[#2d3339] placeholder-[#adb2ba] outline-none transition focus:border-[#5044e3] ${
                  emailStatus === 'invalid' ? 'border-red-400' : 'border-[#e2e5ea]'
                }`}
              />
              <button
                onClick={confirmEmail}
                disabled={emailStatus === 'loading' || !email.trim()}
                className="shrink-0 rounded-xl bg-[#5044e3] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#4035c8] disabled:opacity-50"
              >
                {emailStatus === 'loading' ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : '확인'}
              </button>
            </div>
            {statusMessage[emailStatus] && (
              <p className={`mt-1.5 text-[12px] ${statusMessage[emailStatus]!.color}`}>
                {statusMessage[emailStatus]!.text}
              </p>
            )}
          </div>

          {/* 구분선 */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#e2e5ea]" />
            <span className="text-[12px] text-[#adb2ba]">또는 링크로 초대</span>
            <div className="h-px flex-1 bg-[#e2e5ea]" />
          </div>

          {/* 초대 링크 */}
          <div>
            <button
              onClick={generateLink}
              disabled={generating}
              className="w-full rounded-xl border border-[#e2e5ea] bg-[#f8f9fc] py-2.5 text-[14px] font-medium text-[#5044e3] transition hover:bg-[#ede9fb] disabled:opacity-50"
            >
              {generating ? '링크 생성 중…' : '초대 링크 생성'}
            </button>

            {linkError && <p className="mt-1.5 text-[12px] text-red-500">{linkError}</p>}

            {link && (
              <div className="mt-3 flex gap-2">
                <input
                  readOnly
                  value={link}
                  className="flex-1 rounded-xl border border-[#e2e5ea] bg-[#f8f9fc] px-4 py-2.5 text-[13px] text-[#5a6472] outline-none"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={copy}
                  className={`shrink-0 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition ${
                    copied ? 'bg-green-500 text-white' : 'bg-[#f1f4f9] text-[#5044e3] hover:bg-[#ede9fb]'
                  }`}
                >
                  {copied ? '복사됨 ✓' : '복사'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
