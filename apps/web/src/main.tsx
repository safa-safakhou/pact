import React from "react";
import { createRoot } from "react-dom/client";
import { GameApp } from "./game-app.js";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");
createRoot(root).render(
  <React.StrictMode>
    <GameApp />
  </React.StrictMode>,
);
