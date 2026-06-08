// Browser entry point: mount the React emulator surface. No <StrictMode> — the
// boot effect spins up a singleton engine + a ~94 Hz interval, which StrictMode's
// double-invoke would duplicate. The host contract lives in host/emulator.ts; this
// file is just the React mount.
import { createRoot } from "react-dom/client";
import { App } from "./components/App";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element in index.html");
createRoot(rootEl).render(<App />);
