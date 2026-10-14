import React from "react";
import { createRoot } from "react-dom/client";
import { AdminDashboard } from "./admin-dashboard.js";
import { GameApp } from "./game-app.js";
import { AppealPage } from "./moderation-panel.js";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");
createRoot(root).render(
  <React.StrictMode>
    {window.location.pathname.replace(/\/$/, "").endsWith("/admin") ? (
      <AdminDashboard />
    ) : new URLSearchParams(window.location.hash.slice(1)).has("appeal") ||
      new URLSearchParams(window.location.search).has("appeal") ? (
      <AppealPage />
    ) : (
      <GameApp />
    )}
  </React.StrictMode>,
);
