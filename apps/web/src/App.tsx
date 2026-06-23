// Copyright (C) 2026 MuLeiSY2021
//
// This file is part of Dicelore.
//
// Dicelore is free software: you can redistribute it and/or modify it under
// the terms of the GNU Affero General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See <https://www.gnu.org/licenses/>.

import { BrowserRouter, Routes, Route, Outlet } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeProvider.js";
import { I18nProvider } from "./i18n/index.js";
import { SettingsProvider } from "./settings/useSettings.js";
import { TopBar } from "./shell/TopBar.js";
import HomePage from "./pages/HomePage.js";
import PlayPage from "./pages/PlayPage.js";
import BuildPage from "./pages/BuildPage.js";
import ConfigPage from "./pages/ConfigPage.js";

function Shell() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar />
      <div style={{ flex: 1, minHeight: 0 }}><Outlet /></div>
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <SettingsProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Shell />}>
                <Route index element={<HomePage />} />
                <Route path="play" element={<PlayPage />} />
                <Route path="play/:sessionId" element={<PlayPage />} />
                <Route path="build" element={<BuildPage />} />
                <Route path="config" element={<ConfigPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SettingsProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
