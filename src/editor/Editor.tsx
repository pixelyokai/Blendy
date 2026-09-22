import { useEffect, useRef } from "react";
import { Canvas } from "./Canvas";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { TooltipLayer, usePresence } from "./ui/Overlay";
import { CloseIcon, ErrorIcon, SuccessIcon } from "./ui/Icons";
import { saveToStorage, useEditor, type Align, type Toast } from "../state/editorStore";
import { track } from "../analytics";

const ALIGN_KEYS: Record<string, Align> = {
  KeyA: "left",
  KeyD: "right",
  KeyW: "top",
  KeyS: "bottom",
  KeyH: "hcenter",
  KeyV: "vcenter",
};

export function Editor() {
  useKeyboardShortcuts();
  useClipboard();
  useAutosave();

  return (
    <main className="app">
      <div className="shell">
        <div className="stage">
          <Header />
          <div className="canvas-wrap">
            <Canvas />
          </div>
        </div>
        <Sidebar />
      </div>
      <ToastHost />
      <TooltipLayer />
    </main>
  );
}

/** One toast at a time; it slides in, dismisses itself after a few seconds, and slides out. */
function ToastHost() {
  const toast = useEditor((s) => s.toast);
  const dismiss = useEditor((s) => s.dismissToast);
  const mounted = usePresence(!!toast);
  // Keeps the content while it animates out.
  const last = useRef<Toast>(null);
  if (toast) last.current = toast;
  const shown = last.current;

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(dismiss, 4000);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  if (!mounted || !shown) return null;
  return (
    <div key={shown.id} className="toast" data-kind={shown.kind} data-state={toast ? "open" : "closed"} role="status">
      <span className="toast-icon">{shown.kind === "success" ? <SuccessIcon /> : <ErrorIcon />}</span>
      <span className="toast-text">{shown.message}</span>
      <button className="toast-close" aria-label="Dismiss" onClick={dismiss}>
        <CloseIcon />
      </button>
    </div>
  );
}

function isTextTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  const tag = el?.tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || !!el?.isContentEditable;
}

function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTextTarget(event.target)) return;
      const store = useEditor.getState();
      const key = event.key.toLowerCase();
      const primary = event.metaKey || event.ctrlKey;

      const run = (action: () => void) => {
        event.preventDefault();
        action();
      };

      // event.code, because Option on a Mac turns the letter itself into a symbol.
      if (event.altKey && !primary && ALIGN_KEYS[event.code]) return run(() => store.align(ALIGN_KEYS[event.code]));

      if (primary) {
        if (key === "z") return run(event.shiftKey ? store.redo : store.undo);
        if (key === "y") return run(store.redo);
        if (key === "a") return run(store.selectAll);
        if (key === "d")
          return run(() => {
            store.duplicateSelection();
            track("shape_duplicated");
          });
        return;
      }

      if (key === "delete" || key === "backspace") {
        if (store.selection.length) run(store.deleteSelection);
        return;
      }
      if (key === "escape") return store.clearSelection();

      const step = event.shiftKey ? 10 : 1;
      const nudge: Record<string, [number, number]> = {
        arrowleft: [-step, 0],
        arrowright: [step, 0],
        arrowup: [0, -step],
        arrowdown: [0, step],
      };
      if (nudge[key]) return run(() => store.nudge(...nudge[key]));

      if (key === "+" || key === "=") return run(() => store.zoomBy(1.25));
      if (key === "-" || key === "_") return run(() => store.zoomBy(1 / 1.25));
      if (key === "0") return run(() => store.setViewport({ level: 1 }));
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Native copy/cut/paste events: no permission prompts, and it works across tabs. */
function useClipboard() {
  useEffect(() => {
    const onCopy = (event: ClipboardEvent, cut = false) => {
      if (isTextTarget(event.target)) return;
      const store = useEditor.getState();
      const text = store.copySelection();
      if (!text || !event.clipboardData) return;
      event.preventDefault();
      event.clipboardData.setData("text/plain", text);
      if (cut) store.deleteSelection();
    };
    const onCut = (event: ClipboardEvent) => onCopy(event, true);
    const onPaste = (event: ClipboardEvent) => {
      if (isTextTarget(event.target)) return;
      const text = event.clipboardData?.getData("text/plain");
      if (text && useEditor.getState().paste(text)) event.preventDefault();
    };
    document.addEventListener("copy", onCopy as EventListener);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("copy", onCopy as EventListener);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
    };
  }, []);
}

const SAVE_DELAY = 400;

function useAutosave() {
  useEffect(() => {
    let timer = 0;
    const unsubscribe = useEditor.subscribe((state, previous) => {
      if (state.document === previous.document) return;
      clearTimeout(timer);
      timer = window.setTimeout(() => saveToStorage(useEditor.getState().document), SAVE_DELAY);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
      saveToStorage(useEditor.getState().document);
    };
  }, []);
}
