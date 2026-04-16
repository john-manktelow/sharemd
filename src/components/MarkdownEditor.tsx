"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

interface MarkdownEditorProps {
  repo: string;
  filePath: string;
  onPendingChange?: (path: string, hasPending: boolean) => void;
}

type SaveStatus =
  | "clean" // no changes, no draft
  | "modified" // typing, debounced save pending
  | "saving" // write in flight
  | "draft" // saved to draft branch; not yet published
  | "publishing" // squash-merge in flight
  | "published" // freshly merged (flash state)
  | "conflict" // couldn't auto-merge — needs review
  | "error";

export default function MarkdownEditor({
  repo,
  filePath,
  onPendingChange,
}: MarkdownEditorProps) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("clean");
  const [fileSha, setFileSha] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPendingChangeRef = useRef(onPendingChange);

  useEffect(() => {
    onPendingChangeRef.current = onPendingChange;
  }, [onPendingChange]);

  // Load file content
  useEffect(() => {
    let cancelled = false;

    async function loadFile() {
      setLoading(true);

      const res = await fetch(
        `/api/files?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(filePath)}&type=file`
      );
      const data = await res.json();

      if (!cancelled) {
        setContent(data.content);
        setFileSha(data.sha);
        setSaveStatus(data.hasDraft ? "draft" : "clean");
        setLoading(false);
        // Sync pending state in case this wasn't known from the initial drafts list.
        onPendingChangeRef.current?.(filePath, !!data.hasDraft);
      }
    }

    loadFile();
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  const saveContent = useCallback(
    async (newContent: string) => {
      setSaveStatus("saving");

      try {
        const res = await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repo,
            path: filePath,
            content: newContent,
            sha: fileSha,
          }),
        });

        const data = await res.json();

        if (res.ok) {
          setFileSha(data.sha);
          setSaveStatus("draft");
          onPendingChangeRef.current?.(filePath, true);
        } else {
          setSaveStatus("error");
        }
      } catch {
        setSaveStatus("error");
      }
    },
    [filePath, fileSha]
  );

  const publishNow = useCallback(async () => {
    setSaveStatus("publishing");

    try {
      const res = await fetch("/api/save", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo, path: filePath }),
      });

      if (res.ok) {
        onPendingChangeRef.current?.(filePath, false);
        setSaveStatus("published");
        setTimeout(() => {
          setSaveStatus((s) => (s === "published" ? "clean" : s));
        }, 2000);
      } else if (res.status === 409) {
        setSaveStatus("conflict");
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
  }, [filePath]);

  const handleChange = useCallback(
    (value: string | undefined) => {
      const newContent = value ?? "";
      setContent(newContent);

      setSaveStatus("modified");

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveContent(newContent);
      }, 1500);
    },
    [saveContent]
  );

  const statusIndicator: Record<
    SaveStatus,
    { text: string; title: string; className: string; dot: string }
  > = {
    clean: {
      text: "",
      title: "",
      className: "text-gray-400",
      dot: "bg-transparent",
    },
    modified: {
      text: "Unsaved changes",
      title: "Your changes will save automatically",
      className: "text-gray-500",
      dot: "bg-gray-400",
    },
    saving: {
      text: "Saving…",
      title: "Saving your changes to GitHub",
      className: "text-amber-600",
      dot: "bg-amber-500",
    },
    draft: {
      text: "Draft saved",
      title:
        "Your changes are safely stored in your personal draft. Click Publish to share them.",
      className: "text-amber-600",
      dot: "bg-amber-500",
    },
    publishing: {
      text: "Publishing…",
      title: "Merging your draft into the main document",
      className: "text-blue-600",
      dot: "bg-blue-500",
    },
    published: {
      text: "Published",
      title: "Your changes have been merged",
      className: "text-green-600",
      dot: "bg-green-500",
    },
    conflict: {
      text: "Needs review",
      title:
        "Another edit happened at the same time. Your changes are saved but couldn't be published. Ask an admin to resolve.",
      className: "text-red-600",
      dot: "bg-red-500",
    },
    error: {
      text: "Error",
      title: "Something went wrong. Try again, or reload the page.",
      className: "text-red-600",
      dot: "bg-red-500",
    },
  };

  const status = statusIndicator[saveStatus];
  const canPublish = saveStatus === "draft" || saveStatus === "conflict";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading file...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 gap-4">
        <span className="text-sm font-mono text-gray-600 dark:text-gray-400 truncate">
          {filePath}
        </span>
        <div className="flex items-center gap-3 flex-shrink-0">
          {status.text && (
            <span
              className={`flex items-center gap-2 text-xs font-medium ${status.className}`}
              title={status.title}
            >
              <span className={`w-2 h-2 rounded-full ${status.dot}`} />
              {status.text}
            </span>
          )}
          <button
            onClick={publishNow}
            disabled={!canPublish}
            className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700"
            title={
              canPublish
                ? "Publish your draft — merge it into the shared document"
                : "No draft to publish"
            }
          >
            Publish
          </button>
        </div>
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
