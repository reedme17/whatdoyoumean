/**
 * React renderer entry point.
 * Mounts the App component into the #root div.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found");
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
