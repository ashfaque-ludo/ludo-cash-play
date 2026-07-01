import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Keep Render backend warm — ping every 10 min to prevent cold-start delays
const _ping = () => fetch(`${process.env.REACT_APP_BACKEND_URL}/api/health`).catch(() => {});
_ping();
setInterval(_ping, 10 * 60 * 1000);

// Unregister any stale service workers (old cache name: ludo-cash-play-*),
// then register the current one so fresh HTML/manifest is always served.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
    for (const reg of regs) {
      const swUrl = reg.active?.scriptURL || reg.installing?.scriptURL || '';
      // Keep only the current /service-worker.js; remove any others (old scope or stale)
      if (!swUrl.endsWith('/service-worker.js')) {
        await reg.unregister().catch(() => {});
      }
    }
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
