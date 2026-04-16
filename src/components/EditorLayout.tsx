"use client";

import { useState } from "react";
import FileBrowser from "./FileBrowser";
import MarkdownEditor from "./MarkdownEditor";

export default function EditorLayout() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Left pane: file browser */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
        <FileBrowser onFileSelect={setSelectedFile} selectedFile={selectedFile} />
      </div>

      {/* Right pane: editor */}
      <div className="flex-1 min-w-0">
        {selectedFile ? (
          <MarkdownEditor key={selectedFile} filePath={selectedFile} />
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
