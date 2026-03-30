"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { View } from "./DashboardShell";

type Item = {
  id: string;
  type: "folder" | "lesson";
  title: string;
  updatedAt: string;
  subject?: string;
  parentId: string | null;
  ownerId: string;
  lastAccessedAt?: string;
  deletedAt?: string | null;
  status?: "ongoing" | "ended" | null;
  bookmarked?: boolean;
};

// 오늘 기준 7일 전 날짜
const WEEK_AGO = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
})();

const initialItems: Item[] = [
  { id: "f1", type: "folder", title: "1학기 수업자료", updatedAt: "2026-03-08", parentId: null, ownerId: "me", lastAccessedAt: "2026-03-09" },
  { id: "f2", type: "folder", title: "2학기 준비", updatedAt: "2026-03-01", parentId: null, ownerId: "me", lastAccessedAt: "2026-03-05" },
  { id: "l1", type: "lesson", title: "이차방정식 수업설계", updatedAt: "2026-03-07", subject: "수학", parentId: null, ownerId: "me", lastAccessedAt: "2026-03-09", status: "ongoing" },
  { id: "l2", type: "lesson", title: "함수의 개념 도입", updatedAt: "2026-03-05", subject: "수학", parentId: null, ownerId: "me", lastAccessedAt: "2026-03-05", status: "ongoing" },
  { id: "l3", type: "lesson", title: "통계 기초 수업", updatedAt: "2026-02-28", subject: "수학", parentId: null, ownerId: "me", lastAccessedAt: "2026-02-28", status: "ended" },
  { id: "l4", type: "lesson", title: "도형의 성질", updatedAt: "2026-02-20", subject: "수학", parentId: "f1", ownerId: "me", lastAccessedAt: "2026-03-08", status: "ended" },
  { id: "f3", type: "folder", title: "단원 정리", updatedAt: "2026-02-10", parentId: "f1", ownerId: "me", lastAccessedAt: "2026-02-10" },
  { id: "l5", type: "lesson", title: "과학 실험 수업설계", updatedAt: "2026-03-06", subject: "과학", parentId: null, ownerId: "other1", lastAccessedAt: "2026-03-06", status: "ongoing" },
  { id: "l6", type: "lesson", title: "역사 탐구 프로젝트", updatedAt: "2026-03-04", subject: "역사", parentId: null, ownerId: "other2", lastAccessedAt: "2026-03-04", status: "ended" },
  { id: "l7", type: "lesson", title: "삭제된 수업 예시", updatedAt: "2026-02-15", subject: "수학", parentId: null, ownerId: "me", deletedAt: "2026-02-20", status: "ended" },
];

// ─── 삭제 확인 모달 ──────────────────────────────────────────────

function DeleteConfirmModal({
  itemTitle,
  onConfirm,
  onCancel,
}: {
  itemTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-80 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
          <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h2 className="mb-1 text-sm font-semibold text-gray-900">휴지통으로 이동하시겠습니까?</h2>
        <p className="mb-5 text-xs text-gray-500 line-clamp-2">{itemTitle}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-medium text-white transition hover:bg-red-600"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 컨텍스트 메뉴 ───────────────────────────────────────────────

function ContextMenu({
  x,
  y,
  bookmarked,
  onBookmark,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  bookmarked: boolean;
  onBookmark: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // 화면 밖으로 나가지 않도록 위치 보정
  const style: React.CSSProperties = {
    position: "fixed",
    top: y,
    left: x,
    zIndex: 50,
  };

  return (
    <div
      ref={menuRef}
      style={style}
      className="w-44 rounded-xl border border-gray-200 bg-white py-1.5 shadow-xl"
    >
      <button
        onClick={onBookmark}
        className="flex w-full items-center gap-3 px-4 py-2 text-[14px] text-gray-700 hover:bg-gray-50"
      >
        <svg
          className={`h-4 w-4 ${bookmarked ? "text-amber-400 fill-amber-400" : "text-gray-400"}`}
          fill={bookmarked ? "currentColor" : "none"}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
        {bookmarked ? "북마크 해제" : "북마크"}
      </button>
      <div className="my-1 border-t border-gray-100" />
      <button
        onClick={onDelete}
        className="flex w-full items-center gap-3 px-4 py-2 text-[14px] text-red-500 hover:bg-red-50"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        삭제하기
      </button>
    </div>
  );
}

// ─── 카드 컴포넌트 ────────────────────────────────────────────────

function ParentFolderCard({
  parentName,
  isDragOver,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  parentName: string;
  isDragOver: boolean;
  onClick: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`group relative flex cursor-pointer flex-col transition-all ${
        isDragOver ? "scale-105" : ""
      }`}
    >
      <div className={`h-3 w-2/5 rounded-t-lg transition-colors ${
        isDragOver ? "bg-gray-400" : "bg-gray-300 group-hover:bg-gray-400"
      }`} />
      <div className={`flex flex-1 flex-col rounded-b-xl rounded-tr-xl border-2 p-4 transition-all min-h-[9rem] ${
        isDragOver
          ? "border-gray-400 bg-gray-100 shadow-lg shadow-gray-200"
          : "border-gray-200 bg-gray-50 group-hover:border-gray-300 group-hover:shadow-md"
      }`}>
        {isDragOver && (
          <div className="absolute inset-0 top-3 flex items-center justify-center rounded-b-xl rounded-tr-xl">
            <span className="rounded-lg bg-gray-500 px-3 py-1 text-xs font-semibold text-white shadow">
              상위 폴더로 이동
            </span>
          </div>
        )}
        <div className="mb-3 flex items-start gap-1.5">
          <svg className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <svg className="h-8 w-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <p className="line-clamp-2 text-[15px] font-semibold text-gray-500 group-hover:text-gray-700">
          {parentName}
        </p>
        <p className="mt-auto pt-2 text-[15px] text-gray-400">상위 폴더</p>
      </div>
    </div>
  );
}

function FolderCard({
  item,
  isDragging,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  onContextMenu,
}: {
  item: Item;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const dragMoved = useRef(false);

  return (
    <div
      draggable
      onDragStart={(e) => { dragMoved.current = false; onDragStart(e); }}
      onDrag={() => { dragMoved.current = true; }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => { if (!dragMoved.current) onClick(); }}
      onContextMenu={onContextMenu}
      className={`group relative flex cursor-pointer flex-col transition-all ${
        isDragging ? "opacity-40" : isDragOver ? "scale-105" : ""
      }`}
    >
      <div className={`h-3 w-2/5 rounded-t-lg transition-colors ${
        isDragOver ? "bg-amber-400" : "bg-amber-300 group-hover:bg-amber-400"
      }`} />
      <div className={`flex flex-1 flex-col rounded-b-xl rounded-tr-xl border-2 p-4 transition-all ${
        isDragOver
          ? "border-amber-400 bg-amber-100 shadow-lg shadow-amber-200"
          : "border-amber-200 bg-amber-50 group-hover:border-amber-300 group-hover:shadow-md"
      }`}>
        {isDragOver && (
          <div className="absolute inset-0 top-3 flex items-center justify-center rounded-b-xl rounded-tr-xl">
            <span className="rounded-lg bg-amber-400 px-3 py-1 text-xs font-semibold text-white shadow">
              폴더에 넣기
            </span>
          </div>
        )}
        <div className="mb-3 flex items-start justify-between">
          <svg className="h-8 w-8 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          {item.bookmarked && (
            <svg className="h-4 w-4 text-amber-400 fill-amber-400" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          )}
        </div>
        <p className="line-clamp-2 text-[15px] font-semibold text-amber-900 group-hover:text-amber-700">
          {item.title}
        </p>
        <p className="mt-auto pt-2 text-[15px] text-amber-500">{item.updatedAt}</p>
      </div>
    </div>
  );
}

function LessonCard({
  item,
  isDragging,
  onDragStart,
  onDragEnd,
  onContextMenu,
  onClick,
}: {
  item: Item;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const dragMoved = useRef(false);

  return (
    <div
      draggable
      onDragStart={(e) => { dragMoved.current = false; onDragStart(e); }}
      onDrag={() => { dragMoved.current = true; }}
      onDragEnd={onDragEnd}
      onClick={() => { if (!dragMoved.current) onClick(); }}
      onContextMenu={onContextMenu}
      className={`group flex cursor-pointer flex-col rounded-xl border bg-white p-4 shadow-sm transition-all ${
        isDragging
          ? "opacity-40 shadow-none"
          : "border-gray-200 hover:border-indigo-300 hover:shadow-md"
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
          <svg className="h-5 w-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        {item.bookmarked ? (
          <svg className="h-4 w-4 text-amber-400 fill-amber-400" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        ) : (
          <svg className="h-4 w-4 text-gray-300 opacity-0 transition group-hover:opacity-100" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 6a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm8-16a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4zm0 8a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        )}
      </div>
      <p className="line-clamp-2 text-[15px] font-medium text-gray-900 group-hover:text-indigo-600">
        {item.title}
      </p>
      <div className="mt-auto pt-3">
        {item.subject && (
          <span className="mb-1.5 inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-[15px] font-medium text-indigo-600">
            {item.subject}
          </span>
        )}
        <p className="text-[15px] text-gray-400">{item.updatedAt}</p>
      </div>
    </div>
  );
}

function FlatLessonCard({
  item,
  onContextMenu,
  onClick,
}: {
  item: Item;
  onContextMenu: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="group flex cursor-pointer flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50">
          <svg className="h-5 w-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        {item.bookmarked && (
          <svg className="h-4 w-4 text-amber-400 fill-amber-400" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
        )}
      </div>
      <p className="line-clamp-2 text-[15px] font-medium text-gray-900 group-hover:text-indigo-600">
        {item.title}
      </p>
      <div className="mt-auto pt-3">
        {item.subject && (
          <span className="mb-1.5 inline-block rounded-md bg-indigo-50 px-2 py-0.5 text-[15px] font-medium text-indigo-600">
            {item.subject}
          </span>
        )}
        <p className="text-[15px] text-gray-400">{item.updatedAt}</p>
      </div>
    </div>
  );
}

function TrashCard({
  item,
  onRestore,
  onDelete,
}: {
  item: Item;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex cursor-default flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm opacity-70 transition-all hover:opacity-100">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
          <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      </div>
      <p className="line-clamp-2 text-[15px] font-medium text-gray-500">{item.title}</p>
      <div className="mt-auto pt-3">
        {item.subject && (
          <span className="mb-1.5 inline-block rounded-md bg-gray-100 px-2 py-0.5 text-[15px] font-medium text-gray-400">
            {item.subject}
          </span>
        )}
        <p className="text-[15px] text-gray-400">삭제됨: {item.deletedAt}</p>
      </div>
      {/* 호버 시 액션 */}
      <div className="mt-3 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={onRestore}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-indigo-200 py-1.5 text-[15px] font-medium text-indigo-600 transition hover:bg-indigo-50"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          복원
        </button>
        <button
          onClick={onDelete}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-200 py-1.5 text-[15px] font-medium text-red-500 transition hover:bg-red-50"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          영구삭제
        </button>
      </div>
    </div>
  );
}

// ─── 빈 상태 ──────────────────────────────────────────────────────

const EMPTY_MESSAGES: Record<View, { icon: string; text: string }> = {
  recent: { icon: "clock", text: "최근 1주일 내 접근한 항목이 없습니다" },
  all: { icon: "folder", text: "폴더가 비어 있습니다" },
  mine: { icon: "user", text: "내가 만든 수업설계가 없습니다" },
  shared: { icon: "share", text: "공유받은 수업설계가 없습니다" },
  ongoing: { icon: "ongoing", text: "진행중인 수업설계가 없습니다" },
  ended: { icon: "ended", text: "종료된 수업설계가 없습니다" },
  trash: { icon: "trash", text: "휴지통이 비어 있습니다" },
};

function EmptyIcon({ type }: { type: string }) {
  const cls = "h-10 w-10";
  if (type === "clock")
    return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  if (type === "user")
    return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
  if (type === "share")
    return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>;
  if (type === "trash")
    return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
  if (type === "ongoing")
    return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  if (type === "ended")
    return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  // folder (default)
  return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>;
}

// ─── 뷰 제목 ──────────────────────────────────────────────────────

const VIEW_LABELS: Record<View, string> = {
  recent: "최근",
  all: "전체",
  mine: "내가 만든",
  shared: "공유받은",
  ongoing: "진행중",
  ended: "종료된",
  trash: "휴지통",
};

// ─── 메인 컴포넌트 ────────────────────────────────────────────────

export default function ProjectGrid({
  view,
  userId,
}: {
  view: View;
  userId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ itemId: string; x: number; y: number } | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // 뷰가 바뀌면 폴더 위치 초기화
  useEffect(() => {
    setCurrentFolderId(null);
  }, [view]);

  // ── 필터 로직 ────────────────────────────────────────────────

  const activeItems = items.filter((i) => !i.deletedAt);

  const visibleItems = (() => {
    switch (view) {
      case "recent":
        return activeItems
          .filter((i) => i.lastAccessedAt && i.lastAccessedAt >= WEEK_AGO)
          .sort((a, b) => (b.lastAccessedAt ?? "").localeCompare(a.lastAccessedAt ?? ""));

      case "all":
        return activeItems
          .filter((i) => i.parentId === currentFolderId)
          .sort((a, b) => {
            if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
            return 0;
          });

      case "mine":
        return activeItems
          .filter((i) => i.ownerId === userId || i.ownerId === "me")
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

      case "shared":
        return activeItems
          .filter((i) => i.ownerId !== userId && i.ownerId !== "me")
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

      case "ongoing":
        return activeItems
          .filter((i) => i.type === "lesson" && i.status === "ongoing")
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

      case "ended":
        return activeItems
          .filter((i) => i.type === "lesson" && i.status === "ended")
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

      case "trash":
        return items
          .filter((i) => !!i.deletedAt)
          .sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""));

      default:
        return [];
    }
  })();

  // ── 드래그 핸들러 (all 뷰 전용) ──────────────────────────────

  const isDescendant = (dragId: string, targetFolderId: string): boolean => {
    let current = items.find((i) => i.id === targetFolderId);
    while (current?.parentId) {
      if (current.parentId === dragId) return true;
      current = items.find((i) => i.id === current!.parentId);
    }
    return false;
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    if (!draggingId || draggingId === folderId) return;
    if (isDescendant(draggingId, folderId)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== folderId) setDragOverId(folderId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === folderId) return;
    if (isDescendant(draggingId, folderId)) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === draggingId ? { ...item, parentId: folderId } : item
      )
    );
    setDraggingId(null);
    setDragOverId(null);
  };

  // ── 컨텍스트 메뉴 액션 ───────────────────────────────────────

  const handleContextMenu = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    setContextMenu({ itemId, x: e.clientX, y: e.clientY });
  };

  const handleBookmark = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, bookmarked: !item.bookmarked } : item))
    );
    setContextMenu(null);
  };

  const handleDeleteRequest = (id: string) => {
    setContextMenu(null);
    setDeleteTargetId(id);
  };

  const handleSoftDelete = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, deletedAt: new Date().toISOString().slice(0, 10) } : item
      )
    );
    setDeleteTargetId(null);
  };

  // ── 휴지통 액션 ──────────────────────────────────────────────

  const handleRestore = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, deletedAt: null } : item))
    );
  };

  const handlePermanentDelete = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleEmptyTrash = () => {
    setItems((prev) => prev.filter((item) => !item.deletedAt));
  };

  // ── 브레드크럼 (all 뷰 전용) ─────────────────────────────────

  const getBreadcrumb = (): Item[] => {
    const path: Item[] = [];
    let folderId = currentFolderId;
    while (folderId) {
      const folder = items.find((i) => i.id === folderId);
      if (!folder) break;
      path.unshift(folder);
      folderId = folder.parentId;
    }
    return path;
  };
  const breadcrumb = getBreadcrumb();
  const currentFolder = items.find((i) => i.id === currentFolderId) ?? null;

  const isAllView = view === "all";
  const isTrashView = view === "trash";
  const trashCount = items.filter((i) => !!i.deletedAt).length;
  const empty = EMPTY_MESSAGES[view];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 상단 툴바 (브레드크럼·액션 — 본문 영역 전용) */}
      <div className="flex min-h-[3.25rem] items-center justify-between bg-white/95 px-8 py-2.5 backdrop-blur-sm">
        {/* 제목 / 브레드크럼 */}
        <nav className="flex items-center gap-1.5 text-[18px]">
          {isAllView ? (
            <>
              <button
                onClick={() => setCurrentFolderId(null)}
                className={`font-semibold transition-colors ${
                  currentFolderId === null ? "text-gray-900" : "text-gray-400 hover:text-gray-700"
                }`}
              >
                전체
              </button>
              {breadcrumb.map((folder) => (
                <span key={folder.id} className="flex items-center gap-1">
                  <svg className="h-3.5 w-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <button
                    onClick={() => setCurrentFolderId(folder.id)}
                    className={`font-semibold transition-colors ${
                      folder.id === currentFolderId ? "text-gray-900" : "text-gray-400 hover:text-gray-700"
                    }`}
                  >
                    {folder.title}
                  </button>
                </span>
              ))}
            </>
          ) : (
            <span className="font-semibold text-gray-900">{VIEW_LABELS[view]}</span>
          )}
        </nav>

        {/* 우측 버튼 */}
        <div className="flex items-center gap-2">
          {/* 뒤로가기 (all 뷰, 폴더 안에 있을 때) */}
          {isAllView && currentFolderId && (
            <button
              onClick={() => setCurrentFolderId(currentFolder?.parentId ?? null)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-100"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* 휴지통 비우기 */}
          {isTrashView && trashCount > 0 && (
            <button
              onClick={handleEmptyTrash}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-[15px] font-medium text-red-500 transition hover:bg-red-50"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              비우기
            </button>
          )}

        </div>
      </div>

      {/* 그리드 영역 */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-8">
        {/* 빈 상태 */}
        {visibleItems.length === 0 && !(isAllView && currentFolderId) ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-gray-300">
            <EmptyIcon type={empty.icon} />
            <p className="text-[14px]">{empty.text}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {/* all 뷰 + 폴더 안: 상위 폴더 카드 */}
            {isAllView && currentFolderId && (() => {
              const parentName = currentFolder?.parentId
                ? (items.find((i) => i.id === currentFolder.parentId)?.title ?? "전체")
                : "전체";
              return (
                <ParentFolderCard
                  parentName={parentName}
                  isDragOver={dragOverId === "__parent__"}
                  onClick={() => setCurrentFolderId(currentFolder?.parentId ?? null)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverId("__parent__"); }}
                  onDragLeave={(e) => {
                    if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
                    setDragOverId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!draggingId) return;
                    const parentId = currentFolder?.parentId ?? null;
                    setItems((prev) =>
                      prev.map((item) =>
                        item.id === draggingId ? { ...item, parentId } : item
                      )
                    );
                    setDraggingId(null);
                    setDragOverId(null);
                  }}
                />
              );
            })()}

            {/* all 뷰: 폴더 + 드래그 지원 레슨 */}
            {isAllView &&
              visibleItems.map((item) =>
                item.type === "folder" ? (
                  <FolderCard
                    key={item.id}
                    item={item}
                    isDragging={draggingId === item.id}
                    isDragOver={dragOverId === item.id}
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, item.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, item.id)}
                    onClick={() => setCurrentFolderId(item.id)}
                    onContextMenu={(e) => handleContextMenu(e, item.id)}
                  />
                ) : (
                  <LessonCard
                    key={item.id}
                    item={item}
                    isDragging={draggingId === item.id}
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragEnd={handleDragEnd}
                    onContextMenu={(e) => handleContextMenu(e, item.id)}
                    onClick={() => router.push(`/workspace/${item.id}`)}
                  />
                )
              )}

            {/* trash 뷰 */}
            {isTrashView &&
              visibleItems.map((item) => (
                <TrashCard
                  key={item.id}
                  item={item}
                  onRestore={() => handleRestore(item.id)}
                  onDelete={() => handlePermanentDelete(item.id)}
                />
              ))}

            {/* 나머지 flat 뷰 (recent, mine, shared) */}
            {!isAllView &&
              !isTrashView &&
              visibleItems.map((item) => (
                <FlatLessonCard
                  key={item.id}
                  item={item}
                  onContextMenu={(e) => handleContextMenu(e, item.id)}
                  onClick={() => router.push(`/workspace/${item.id}`)}
                />
              ))}
          </div>
        )}

        {/* 빈 폴더 메시지 (상위 폴더 카드는 이미 그리드에 표시됨) */}
        {isAllView && currentFolderId && visibleItems.length === 0 && (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-gray-300">
            <EmptyIcon type={empty.icon} />
            <p className="text-[14px]">{empty.text}</p>
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {deleteTargetId && (() => {
        const target = items.find((i) => i.id === deleteTargetId);
        if (!target) return null;
        return (
          <DeleteConfirmModal
            itemTitle={target.title}
            onConfirm={() => handleSoftDelete(deleteTargetId)}
            onCancel={() => setDeleteTargetId(null)}
          />
        );
      })()}

      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (() => {
        const target = items.find((i) => i.id === contextMenu.itemId);
        if (!target) return null;
        return (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            bookmarked={!!target.bookmarked}
            onBookmark={() => handleBookmark(contextMenu.itemId)}
            onDelete={() => handleDeleteRequest(contextMenu.itemId)}
            onClose={() => setContextMenu(null)}
          />
        );
      })()}
    </div>
  );
}
