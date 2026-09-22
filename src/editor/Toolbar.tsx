import { useRef, useState, type ReactNode } from "react";
import { useEditor } from "../state/editorStore";
import { useUi } from "../state/uiStore";
import { exportPng, exportSvg } from "../export/artwork";
import { downloadBlob } from "../utils/download";
import { track } from "../analytics";
import { Popover } from "./ui/Overlay";
import { DownloadIcon, HelpIcon, MoonIcon, PixelGridIcon, ResetIcon, RulerIcon, ShuffleIcon, SunIcon } from "./ui/Icons";

const mod = navigator.platform.startsWith("Mac") ? "Cmd" : "Ctrl";

const SHORTCUTS: [string, string][] = [
  [`${mod} + Z`, "Undo"],
  [`${mod} + Y`, "Redo"],
  [`${mod} + C / X / V`, "Copy / Cut / Paste"],
  ["Alt + drag", "Duplicate while dragging"],
  ["Delete / Backspace", "Delete"],
  ["Arrow keys", "Nudge 1"],
  ["Shift + arrow keys", "Nudge 10"],
  ["Alt + A / D", "Align left / right"],
  ["Alt + W / S", "Align top / bottom"],
  ["Alt + H / V", "Align centre / middle"],
  [`Hold ${mod} while dragging`, "Disable snapping"],
  [`${mod} + D`, "Duplicate"],
  [`${mod} + A`, "Select all"],
  ["Shift + click / drag", "Add to selection"],
  ["Shift + drag handle", "Keep aspect ratio"],
  ["Alt + drag handle", "Resize from centre"],
  ["Shift + rotate", "Snap to 15°"],
  [`+ / - or ${mod} + scroll`, "Zoom in / out"],
  ["0", "Zoom to fit"],
  ["Esc", "Deselect"],
];

function IconButton({ tip, active, onClick, children, ...rest }: { tip: string; active?: boolean; onClick: () => void; children: ReactNode; "aria-expanded"?: boolean }) {
  return (
    <button className="icon-btn" data-tip={tip} aria-label={tip} aria-pressed={active} data-active={active || undefined} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}

/** App actions on top of the sidebar: view toggles, canvas actions, help and export. */
export function Toolbar() {
  const { theme, rulers, pixelGrid, toggle, toggleTheme } = useUi();
  const clear = useEditor((s) => s.clear);
  const generate = useEditor((s) => s.generate);
  const [menu, setMenu] = useState<"help" | "export" | null>(null);
  const helpRef = useRef<HTMLButtonElement>(null);
  const exportRef = useRef<HTMLButtonElement>(null);
  const close = () => setMenu(null);

  const exportAs = async (format: "svg" | "png") => {
    close();
    const { document: doc, showToast } = useEditor.getState();
    try {
      if (format === "svg") downloadBlob(new Blob([exportSvg(doc)], { type: "image/svg+xml" }), "blendy.svg");
      else downloadBlob(await exportPng(doc), "blendy.png");
      track("export_completed", { format, shapes: doc.shapes.length });
      showToast("Artwork downloaded successfully.", "success");
    } catch {
      track("export_failed", { format });
      showToast("Failed to export artwork. Try again.");
    }
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <IconButton tip={theme === "dark" ? "Light mode" : "Dark mode"} onClick={toggleTheme}>
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </IconButton>
        <span className="toolbar-sep" />
        <IconButton tip="Reset canvas" onClick={() => (clear(), track("reset_used"))}>
          <ResetIcon />
        </IconButton>
        <IconButton tip="Generate" onClick={generate}>
          <ShuffleIcon />
        </IconButton>
        <span className="toolbar-sep" />
        <button
            ref={helpRef}
            className="icon-btn"
            data-tip="Shortcuts"
            aria-label="Shortcuts"
            aria-expanded={menu === "help"}
            data-active={menu === "help" || undefined}
            onClick={() => setMenu((m) => (m === "help" ? null : "help"))}
          >
            <HelpIcon />
          </button>
          <Popover open={menu === "help"} onClose={close} anchor={helpRef} align="center" label="Shortcuts" className="shortcuts-menu">
            <div className="menu-scroll">
              <div className="menu-head">Shortcuts</div>
              {SHORTCUTS.map(([keys, action]) => (
                <div className="menu-row" key={keys}>
                  <span className="menu-keys">{keys}</span>
                  <span className="menu-action">{action}</span>
                </div>
              ))}
            </div>
          </Popover>
        <IconButton tip={pixelGrid ? "Hide pixel grid" : "Show pixel grid"} active={pixelGrid} onClick={() => toggle("pixelGrid")}>
          <PixelGridIcon />
        </IconButton>
        <IconButton tip={rulers ? "Hide rulers" : "Show rulers"} active={rulers} onClick={() => toggle("rulers")}>
          <RulerIcon />
        </IconButton>
      </div>

      <button
          ref={exportRef}
          className="export-btn"
          aria-expanded={menu === "export"}
          onClick={() => {
            setMenu((m) => (m === "export" ? null : "export"));
            track("export_opened");
          }}
        >
          <DownloadIcon />
          Export
        </button>
        <Popover open={menu === "export"} onClose={close} anchor={exportRef} className="export-menu">
          {(["svg", "png"] as const).map((format) => (
            <button key={format} className="menu-item" role="menuitem" onClick={() => exportAs(format)}>
              {format.toUpperCase()}
            </button>
          ))}
        </Popover>
    </div>
  );
}
