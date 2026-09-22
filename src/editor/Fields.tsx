import { useEffect, useRef, useState } from "react";
import { useEditor } from "../state/editorStore";
import { round } from "../utils/clamp";

type NumberProps = {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Short one-letter label, as in the X / Y / W / H pairs. */
  compact?: boolean;
};

/**
 * Numeric field. The typed value stays local until Enter or blur, so a half-typed
 * number never reaches the document or the history stack; Escape reverts.
 */
export function NumberField({ label, value, onCommit, min, max, step = 1, compact }: NumberProps) {
  const [draft, setDraft] = useState(String(round(value)));
  const [editing, setEditing] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(String(round(value)));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft);
    if (cancelled.current || !draft.trim() || !Number.isFinite(parsed)) {
      cancelled.current = false;
      setDraft(String(round(value)));
      return;
    }
    onCommit(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed)));
  };

  return (
    <label className={`field${compact ? " compact" : ""}`}>
      <span className="field-label">{label}</span>
      <span className="input">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={draft}
          onFocus={(e) => {
            setEditing(true);
            e.currentTarget.select();
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            else if (e.key === "Escape") {
              cancelled.current = true;
              e.currentTarget.blur();
            }
            e.stopPropagation();
          }}
        />
      </span>
    </label>
  );
}

/**
 * Swatch (opens the system picker) plus hex text. One undo step per edit; the hex
 * keeps a local draft so a half-typed colour is not rejected.
 */
export function ColorInput({ label, value, mixed, onInput }: { label: string; value: string; mixed?: boolean; onInput: (v: string) => void }) {
  const beginTransaction = useEditor((s) => s.beginTransaction);
  const endTransaction = useEditor((s) => s.endTransaction);
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(mixed ? "" : value);
  }, [value, mixed, editing]);

  return (
    <span className="input color-input">
      <span className="swatch" style={{ background: mixed ? undefined : value }} data-mixed={mixed || undefined}>
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          aria-label={`${label} colour`}
          onFocus={beginTransaction}
          onBlur={endTransaction}
          onChange={(e) => onInput(e.target.value)}
        />
      </span>
      <input
        className="hex"
        value={draft}
        placeholder={mixed ? "Mixed" : undefined}
        aria-label={`${label} hex value`}
        spellCheck={false}
        maxLength={9}
        onFocus={() => {
          setEditing(true);
          beginTransaction();
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          onInput(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`);
        }}
        onBlur={() => {
          setEditing(false);
          endTransaction();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
          e.stopPropagation();
        }}
      />
    </span>
  );
}

/** Live slider: drags update the document continuously and commit once on release. */
export function GooSlider({ value, onInput, onStart, onEnd }: { value: number; onInput: (v: number) => void; onStart: () => void; onEnd: () => void }) {
  return (
    <div className="slider-row">
      <input
        className="slider"
        type="range"
        min={0}
        max={100}
        value={value}
        aria-label="Goo amount"
        style={{ "--pct": `${value}%` } as React.CSSProperties}
        onPointerDown={onStart}
        onKeyDown={onStart}
        onChange={(e) => onInput(Number(e.target.value))}
        onPointerUp={onEnd}
        onKeyUp={onEnd}
        onBlur={onEnd}
      />
      <span className="slider-value">{Math.round(value)}%</span>
    </div>
  );
}
