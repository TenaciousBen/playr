import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "@/src/renderer/ui/App";

const el = document.getElementById("root");
if (!el) throw new Error("Missing #root element");

createRoot(el).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);


