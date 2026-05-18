import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { IntakeChat } from "./pages/IntakeChat";
import { SearchStatus } from "./pages/SearchStatus";
import { Results } from "./pages/Results";
import { Booking } from "./pages/Booking";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/chat" element={<IntakeChat />} />
        <Route path="/search" element={<SearchStatus />} />
        <Route path="/results" element={<Results />} />
        <Route path="/booking" element={<Booking />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
