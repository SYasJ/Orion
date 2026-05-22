import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { QuickAsk } from "./components/QuickAsk";
import { IS_TAURI } from "./lib/bridge";
import "highlight.js/styles/github-dark.css";
import "./styles/global.css";

// The same bundle serves both windows; the label decides what to render.
let isQuickAsk = false;
if (IS_TAURI) {
  try {
    isQuickAsk = getCurrentWindow().label === "quickask";
  } catch {
    isQuickAsk = false;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isQuickAsk ? <QuickAsk /> : <App />}</React.StrictMode>,
);
