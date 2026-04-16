"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface MarkdownEditorProps {
  filePath: string;
}

type SaveStatus = "saved" | "saving" | "modified" | "error" | "merging";

function generateBranchName(filePath: string): string {
  const sanitized = filePath.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/-+/g, "-");
  const timestamp = Date.now();
  return `sharemd/${sanitized}-${timestamp}`;
}

export default function MarkdownEditor({ filePath }: MarkdownEditorProps) {
  const [content, setContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [branch, setBranch] = useState<string | null>(null);
  const [fileSha, setFileSha] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const branchRef = useRef<string | null>(null);

  // Load file content
  useEffect(() => {
    let cancelled = false;

    async function loadFile() {
      setLoading(true);
      setSaveStatus("saved");
      setBranch(null);
      branchRef.current = null;

      const res = await fetch(
        `/api/files?path=${encodeURIComponent(filePath)}&type=file`
      );
      const data = await res.json();

      if (!cancelled) {
        setContent(data.content);
        setOriginalContent(data.content);
        setFileSha(data.sha);
        setLoading(false);
      }
    }

    loadFile();
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  // Squash-merge on unmount / file change
  useEffect(() => {
    return () => {
      const currentBranch = branchRef.current;
      if (currentBranch) {
        fetch("/api/save", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            branch: currentBranch,
            message: `Update ${filePath} via ShareMD`,
          }),
        });
      }
    };
  }, [filePath]);

  const ensureBranch = useCallback(async (): Promise<string> => {
    if (branchRef.current) {
      return branchRef.current;
    }

    const newBranch = generateBranchName(filePath);
    await fetch("/api/save", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branch: newBranch }),
    });

    setBranch(newBranch);
    branchRef.current = newBranch;
    return newBranch;
  }, [filePath]);

  const saveContent = useCallback(
    async (newContent: string) => {
      setSaveStatus("saving");

      try {
        const workBranch = await ensureBranch();

        const res = await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: filePath,
            content: newContent,
            branch: workBranch,
            sha: fileSha,
          }),
        });

        const data = await res.json();

        if (res.ok) {
          setFileSha(data.sha);
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }
      } catch {
        setSaveStatus("error");
      }
    },
    [filePath, fileSha, ensureBranch]
  );

  const handleChange = useCallback(
    (value: string | undefined) => {
      const newContent = value ?? "";
      setContent(newContent);

      if (newContent === originalContent) {
        setSaveStatus("saved");
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        return;
      }

      setSaveStatus("modified");

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveContent(newContent);
      }, 1500);
    },
    [originalContent, saveContent]
  );

  const statusIndicator = {
    saved: { text: "Saved", className: "text-green-600" },
    saving: { text: "Saving...", className: "text-yellow-600" },
    modified: { text: "Modified", className: "text-yellow-600" },
    error: { text: "Error saving", className: "text-red-600" },
    merging: { text: "Merging...", className: "text-blue-600" },
  };

  const status = statusIndicator[saveStatus];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading file...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <span className="text-sm font-mono text-gray-600 dark:text-gray-400 truncate">
          {filePath}
        </span>
        <span className={`text-xs font-medium ${status.className}`}>
          {status.text}
        </span>
      </div>
      <div className="flex-1 overflow-hidden" data-color-mode="light">
        <MDEditor
          value={content}
          onChange={handleChange}
          height="100%"
          preview="live"
          visibleDragbar={false}
        />
      </div>
    </div>
  );
}
