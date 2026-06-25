import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Keep Render backend warm — ping every 10 min to prevent cold-start delays
const _ping = () => fetch(`${process.env.REACT_APP_BACKEND_URL}/api/health`).catch(() => {});
_ping();
setInterval(_ping, 10 * 60 * 1000);

// Register service worker for PWA installability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .catch(() => {});
  });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
