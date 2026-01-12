import React from "react";
import {createRoot} from "react-dom/client";

import "@excalidraw/excalidraw/index.css";
import "./styles.css";

import {App} from "./App";
import {initDevEnvApiKeys} from "../sdk/ai/config";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root container not found");
}

initDevEnvApiKeys();

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
