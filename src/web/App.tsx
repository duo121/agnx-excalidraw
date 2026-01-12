import React, {useEffect} from "react";
import {BrowserRouter, Route, Routes, useNavigate} from "react-router-dom";
import {nanoid} from "nanoid";

import DiagramPage from "./app/diagram/[id]/page";
import {readLastDiagramId} from "./lib/diagram-id";

const HomeRedirect: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const lastId = readLastDiagramId();
    const nextId = lastId || `diag_${nanoid(10)}`;
    navigate(`/diagram/${nextId}`, {replace: true});
  }, [navigate]);

  return null;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/diagram/:id" element={<DiagramPage />} />
      </Routes>
    </BrowserRouter>
  );
};
