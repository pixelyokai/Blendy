import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

/** Exit animations run on elements that must stay mounted a beat after closing. */
const EXIT_MS = 160;

export function usePresence(open: boolean) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
    else if (mounted) {
      const t = setTimeout(() => setMounted(false), EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);
  return mounted;
}

/**
 * Menu anchored under its trigger, in a portal so no panel clips it. Scales and
 * un-blurs in from the trigger, and back out on close. Outside clicks and Escape
 * close it. `align` is which edge of the trigger it lines up with.
 */
export function Popover({
  open,
  onClose,
  anchor,
  align = "end",
  label,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchor: RefObject<HTMLElement>;
  align?: "center" | "end";
  /** Given for a panel of information rather than a menu of actions. */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  const mounted = usePresence(open);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const r = anchor.current.getBoundingClientRect();
    setPos(align === "center" ? { top: r.bottom + 6, left: r.left + r.width / 2 } : { top: r.bottom + 6, right: innerWidth - r.right });
  }, [open, anchor, align]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, onClose, anchor]);

  if (!mounted) return null;
  return createPortal(
    <div ref={ref} className={`menu ${className ?? ""}`} data-state={open ? "open" : "closed"} data-align={align} role={label ? "dialog" : "menu"} aria-label={label} style={pos}>
      {children}
    </div>,
    document.body,
  );
}

type Tip = { label: string; x: number; y: number; below: boolean };

/**
 * One tooltip for the whole app: anything with `data-tip` gets it. The first
 * shows after a short rest; moving to a neighbour while one is up is instant.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [open, setOpen] = useState(false);
  const mounted = usePresence(open);
  const state = useRef({ timer: 0, warm: 0, el: null as HTMLElement | null, pressed: null as HTMLElement | null });

  useEffect(() => {
    const s = state.current;
    const show = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const below = r.top < 60;
      setTip({ label: el.dataset.tip ?? "", x: r.left + r.width / 2, y: below ? r.bottom + 6 : r.top - 6, below });
      setOpen(true);
    };
    const hide = () => {
      clearTimeout(s.timer);
      // Once pressed, a control keeps quiet until the pointer leaves it.
      s.pressed = s.el;
      s.el = null;
      setOpen(false);
      clearTimeout(s.warm);
      // A tooltip seen moments ago keeps the next one instant.
      s.warm = window.setTimeout(() => (s.warm = 0), 300) || 1;
    };
    const enter = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>("[data-tip]");
      if (!el || el === s.el || el === s.pressed) return;
      s.pressed = null;
      if (el.getAttribute("aria-expanded") === "true") return;
      clearTimeout(s.timer);
      s.el = el;
      if (open || s.warm) show(el);
      else s.timer = window.setTimeout(() => s.el === el && show(el), 450);
    };
    const leave = (e: Event) => {
      const next = (e as PointerEvent).relatedTarget as Element | null;
      if (s.pressed && !(next && s.pressed.contains(next))) s.pressed = null;
      if (s.el && next && s.el.contains(next)) return;
      if (s.el) hide();
    };
    document.addEventListener("pointerover", enter);
    document.addEventListener("pointerout", leave);
    document.addEventListener("focusin", enter);
    document.addEventListener("focusout", leave);
    document.addEventListener("pointerdown", hide, true);
    return () => {
      document.removeEventListener("pointerover", enter);
      document.removeEventListener("pointerout", leave);
      document.removeEventListener("focusin", enter);
      document.removeEventListener("focusout", leave);
      document.removeEventListener("pointerdown", hide, true);
      clearTimeout(s.timer);
    };
  }, [open]);

  // Keep it on screen horizontally once its width is known.
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !tip) return;
    const half = el.offsetWidth / 2;
    el.style.left = `${Math.min(Math.max(tip.x, half + 8), innerWidth - half - 8)}px`;
  }, [tip, mounted]);

  if (!mounted || !tip) return null;
  return (
    <div
      ref={ref}
      className="tooltip"
      role="tooltip"
      data-state={open ? "open" : "closed"}
      data-side={tip.below ? "bottom" : "top"}
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.label}
    </div>
  );
}
