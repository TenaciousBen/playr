import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/src/renderer/features/shell/AppShell";
import { AuthorFeature } from "@/src/renderer/features/author/AuthorFeature";
import { CollectionFeature } from "@/src/renderer/features/collections/CollectionFeature";
import { LibraryFeature } from "@/src/renderer/features/library/LibraryFeature";
import { SettingsFeature } from "@/src/renderer/features/settings/SettingsFeature";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/library" replace />} />
        <Route path="/library" element={<LibraryFeature />} />
        <Route path="/author/:authorName" element={<AuthorFeature />} />
        <Route path="/collections/:collectionId" element={<CollectionFeature />} />
        <Route path="/recent" element={<LibraryFeature mode="recent" />} />
        <Route path="/reading" element={<LibraryFeature mode="reading" />} />
        <Route path="/favorites" element={<LibraryFeature mode="favorites" />} />
        <Route path="/settings" element={<SettingsFeature />} />
      </Route>

      <Route path="*" element={<Navigate to="/library" replace />} />
    </Routes>
  );
}


