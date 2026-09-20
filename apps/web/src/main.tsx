import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App(): React.JSX.Element {
  return (
    <main>
      <p className="eyebrow">PACT · FOUNDATION</p>
      <h1>Your kingdom is waiting.</h1>
      <p>
        The shared world is not active yet. This shell verifies that the web client, API, workers, and database can
        evolve from one workspace.
      </p>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element");
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
