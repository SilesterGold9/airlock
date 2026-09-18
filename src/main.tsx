import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { LocaleProvider } from "./lib/i18n";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LocaleProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </LocaleProvider>
  </React.StrictMode>
);
