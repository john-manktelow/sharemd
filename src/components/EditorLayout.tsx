"use client";

import { useCallback, useEffect, useState } from "react";
import FileBrowser from "./FileBrowser";
import MarkdownEditor from "./MarkdownEditor";

export default function EditorLayout() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Set<string>>(new Set());

  // Load the user's existing drafts so the tree indicators are correct on first render.
  useEffect(() => {
    let cancelled = false;

    async function loadDrafts() {
      const res = await fetch("/api/drafts");
      if (!res.ok) {
        return;
      }
      const drafts: { path: string }[] = await res.json();
      if (cancelled) {
        return;
      }
      setPendingFiles(new Set(drafts.map((d) => d.path)));
    }

    loadDrafts();
    return () => {
      cancelled = true;
    };
  }, []);

  const setPending = useCallback((path: string, hasPending: boolean) => {
    setPendingFiles((prev) => {
      const next = new Set(prev);
      if (hasPending) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });
  }, []);

  return (
    <div className="flex h-[calc(100vh-57px)]">
      <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
        <FileBrowser
          onFileSelect={setSelectedFile}
          selectedFile={selectedFile}
          pendingFiles={pendingFiles}
        />
      </div>

      <div className="flex-1 min-w-0">
        {selectedFile ? (
          <MarkdownEditor
            key={selectedFile}
            filePath={selectedFile}
            onPendingChange={setPending}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <p className="text-lg mb-1">Select a file to edit</p>
              <p className="text-sm">Choose a markdown file from the file browser</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
