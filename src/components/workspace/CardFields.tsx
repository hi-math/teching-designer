'use client';

import { useRef, useEffect } from 'react';
import type { CardSchema, FieldDef, BulletsFieldDef, TableFieldDef, TableColumn } from './cardSchemas';

// ─── Auto-resize textarea ─────────────────────────────────────────────

function AutoResizeTextarea({
  value, onChange, disabled, placeholder, className,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      rows={1}
      className={className}
      style={{ resize: 'none', overflow: 'hidden' }}
    />
  );
}

// ─── Bullets field ────────────────────────────────────────────────────

function BulletsInput({
  field, value, onChange, locked,
}: {
  field: BulletsFieldDef;
  value: unknown;
  onChange: (v: string[]) => void;
  locked: boolean;
}) {
  const items: string[] = Array.isArray(value)
    ? (value as string[])
    : Array(field.minRows ?? 3).fill('');

  const update = (idx: number, text: string) => {
    const next = [...items];
    next[idx] = text;
    onChange(next);
  };
  const addRow = () => onChange([...items, '']);
  const removeRow = (idx: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-1.5" onClick={e => e.stopPropagation()}>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className="shrink-0 text-[15px] font-bold text-[#5044e3]">•</span>
          <input
            type="text"
            value={item}
            onChange={e => update(idx, e.target.value)}
            disabled={locked}
            placeholder={`항목 ${idx + 1}`}
            className="flex-1 rounded-lg bg-[#f1f4f9] px-3 py-2 text-[14px] text-[#2d3339] placeholder-[#adb2ba] outline-none focus:ring-2 focus:ring-[#5044e3]/20 disabled:opacity-50"
          />
          {!locked && items.length > 1 && (
            <button
              onClick={() => removeRow(idx)}
              className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-[#adb2ba] hover:bg-red-50 hover:text-red-400"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ))}
      {!locked && (
        <button
          onClick={addRow}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-[#5044e3] hover:bg-[#ede9fb] transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          항목 추가
        </button>
      )}
    </div>
  );
}

// ─── Table cell ────────────────────────────────────────────────────────

function TableCell({
  col, value, onChange, locked,
}: {
  col: TableColumn;
  value: string;
  onChange: (v: string) => void;
  locked: boolean;
}) {
  const base =
    `w-full bg-transparent px-2.5 py-2 text-[13px] text-[#2d3339] placeholder-[#c8cdd4] outline-none focus:bg-[#f8f9ff] disabled:opacity-50 ${
      col.align === 'center' ? 'text-center' : ''
    }`;

  if (col.type === 'select') {
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={locked}
        className={base + ' cursor-pointer'}
      >
        <option value="">—</option>
        {col.options?.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (col.type === 'date') {
    return (
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={locked}
        className={base}
      />
    );
  }
  if (col.type === 'textarea') {
    return (
      <AutoResizeTextarea
        value={value}
        onChange={onChange}
        disabled={locked}
        placeholder={col.label}
        className={base}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={locked}
      placeholder={col.label}
      className={base}
    />
  );
}

// ─── Table field ───────────────────────────────────────────────────────

function TableInput({
  field, value, onChange, locked,
}: {
  field: TableFieldDef;
  value: unknown;
  onChange: (v: Record<string, string>[]) => void;
  locked: boolean;
}) {
  const emptyRow = () =>
    Object.fromEntries(field.columns.map(c => [c.key, ''])) as Record<string, string>;

  const rows: Record<string, string>[] = Array.isArray(value) && value.length > 0
    ? (value as Record<string, string>[])
    : Array(field.minRows ?? 3).fill(null).map(emptyRow);

  const updateCell = (rowIdx: number, key: string, val: string) => {
    const next = rows.map((row, i) =>
      i === rowIdx ? { ...row, [key]: val } : row
    );
    onChange(next);
  };
  const addRow = () => onChange([...rows, emptyRow()]);
  const deleteRow = (idx: number) => {
    if (rows.length <= 1) return;
    onChange(rows.filter((_, i) => i !== idx));
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-[#e2e4ea]" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="flex bg-[#f1f4f9] border-b border-[#e2e4ea]">
        {field.columns.map(col => (
          <div
            key={col.key}
            style={{ flex: col.flex ?? 1 }}
            className={`shrink-0 min-w-0 px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#757b82] border-r last:border-r-0 border-[#e2e4ea] ${
              col.align === 'center' ? 'text-center' : ''
            }`}
          >
            {col.label}
          </div>
        ))}
        <div className="w-7 shrink-0" />
      </div>

      {/* Rows */}
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex border-b last:border-b-0 border-[#e2e4ea] hover:bg-[#fafbff]">
          {field.columns.map(col => (
            <div
              key={col.key}
              style={{ flex: col.flex ?? 1 }}
              className="shrink-0 min-w-0 border-r last:border-r-0 border-[#e2e4ea]"
            >
              <TableCell
                col={col}
                value={row[col.key] ?? ''}
                onChange={v => updateCell(rowIdx, col.key, v)}
                locked={locked}
              />
            </div>
          ))}
          <div className="w-7 shrink-0 flex items-center justify-center">
            {!locked && rows.length > 1 && (
              <button
                onClick={() => deleteRow(rowIdx)}
                className="flex h-5 w-5 items-center justify-center rounded text-[#adb2ba] hover:bg-red-50 hover:text-red-400"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Add row */}
      {!locked && (
        <button
          onClick={addRow}
          className="flex w-full items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-[#5044e3] hover:bg-[#f4f2ff] transition-colors border-t border-[#e2e4ea]"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          행 추가
        </button>
      )}
    </div>
  );
}

// ─── Single field renderer ─────────────────────────────────────────────

function FieldRenderer({
  field, value, onChange, locked,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  locked: boolean;
}) {
  const labelEl = field.label && (
    <p className="mb-1.5 text-[12px] font-semibold text-[#757b82]">{field.label}</p>
  );

  if (field.type === 'bullets') {
    return (
      <div>
        {labelEl}
        <BulletsInput
          field={field}
          value={value}
          onChange={onChange}
          locked={locked}
        />
      </div>
    );
  }

  if (field.type === 'table') {
    return (
      <div>
        {labelEl}
        <TableInput
          field={field}
          value={value}
          onChange={onChange as (v: Record<string, string>[]) => void}
          locked={locked}
        />
      </div>
    );
  }

  if (field.type === 'richtext') {
    return (
      <div onClick={e => e.stopPropagation()}>
        {labelEl}
        <div className="rounded-xl border border-[#c4bef5] bg-[#f4f2ff] overflow-hidden">
          <AutoResizeTextarea
            value={typeof value === 'string' ? value : ''}
            onChange={onChange as (v: string) => void}
            disabled={locked}
            placeholder="핵심 결과물을 입력하세요…"
            className="w-full bg-transparent px-4 py-3 text-[15px] font-semibold text-[#2d3339] placeholder-[#c4bef5] outline-none disabled:opacity-50"
          />
        </div>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div onClick={e => e.stopPropagation()}>
        {labelEl}
        <AutoResizeTextarea
          value={typeof value === 'string' ? value : ''}
          onChange={onChange as (v: string) => void}
          disabled={locked}
          placeholder={field.placeholder ?? '내용을 입력하세요…'}
          className="w-full min-h-[72px] rounded-xl bg-[#f1f4f9] px-4 py-3 text-[14px] text-[#2d3339] placeholder-[#adb2ba] outline-none focus:ring-2 focus:ring-[#5044e3]/20 disabled:opacity-50"
        />
      </div>
    );
  }

  // text
  return (
    <div onClick={e => e.stopPropagation()}>
      {labelEl}
      <input
        type="text"
        value={typeof value === 'string' ? value : ''}
        onChange={e => (onChange as (v: string) => void)(e.target.value)}
        disabled={locked}
        placeholder={field.placeholder ?? '내용을 입력하세요…'}
        className="w-full rounded-xl bg-[#f1f4f9] px-4 py-3 text-[14px] text-[#2d3339] placeholder-[#adb2ba] outline-none focus:ring-2 focus:ring-[#5044e3]/20 disabled:opacity-50"
      />
    </div>
  );
}

// ─── Main: CardFieldRenderer ──────────────────────────────────────────

export default function CardFieldRenderer({
  schema, value, onChange, locked,
}: {
  schema: CardSchema;
  value: Record<string, unknown>;
  onChange: (fields: Record<string, unknown>) => void;
  locked: boolean;
}) {
  const handleFieldChange = (key: string, val: unknown) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <div className="space-y-4" onClick={e => e.stopPropagation()}>
      {schema.fields.map(field => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={value[field.key]}
          onChange={v => handleFieldChange(field.key, v)}
          locked={locked}
        />
      ))}
    </div>
  );
}
