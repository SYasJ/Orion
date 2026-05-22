import { getCurrentWindow } from "@tauri-apps/api/window";
import { IS_TAURI } from "../lib/bridge";
import { CloseIcon, MaximizeIcon, MinimizeIcon } from "./Icons";

/** Frameless custom title bar. The brand + spacer act as the drag region. */
export function TitleBar() {
  const win = IS_TAURI ? getCurrentWindow() : null;

  return (
    <div className="titlebar">
      <div className="titlebar-brand" data-tauri-drag-region>
        <span className="brand-mark" />
        ORION
      </div>
      <div className="titlebar-spacer" data-tauri-drag-region />
      <div className="win-btns">
        <button
          className="win-btn"
          title="Minimize"
          onClick={() => win?.minimize()}
        >
          <MinimizeIcon size={14} />
        </button>
        <button
          className="win-btn"
          title="Maximize"
          onClick={() => win?.toggleMaximize()}
        >
          <MaximizeIcon size={12} />
        </button>
        <button
          className="win-btn close"
          title="Close"
          onClick={() => win?.close()}
        >
          <CloseIcon size={14} />
        </button>
      </div>
    </div>
  );
}
