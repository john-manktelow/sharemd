"use client";

import { useCallback, useEffect, useState } from "react";
import { UserMenu } from "./SignIn";
import RepoPicker from "./RepoPicker";
import FileBrowser from "./FileBrowser";
import MarkdownEditor from "./MarkdownEditor";

interface AccessibleRepo {
  owner: string;
  repo: string;
  fullName: string;
}

interface ReposResponse {
  repos: AccessibleRepo[];
  installUrl: string;
}

export default function EditorLayout() {
  const [reposData, setReposData] = useState<ReposResponse | null>(null);
  const [reposLoading, setReposLoading] = useState(true);
  const [reposError, setReposError] = useState<string | null>(null);

  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Set<string>>(new Set());

  // Fetch available repos on mount.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/repos");
        if (!res.ok) {
          setReposError("Failed to load repositories");
          setReposLoading(false);
          return;
        }
        const data: ReposResponse = await res.json();
        if (cancelled) {
          return;
        }
        setReposData(data);

        // Auto-select if there's only one repo.
        if (data.repos.length === 1) {
          setSelectedRepo(data.repos[0].fullName);
        }
      } catch {
        if (!cancelled) {
          setReposError("Failed to load repositories");
        }
      }
      if (!cancelled) {
        setReposLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Clear file selection and pending state when the repo changes.
  useEffect(() => {
    setSelectedFile(null);
    setPendingFiles(new Set());
  }, [selectedRepo]);

  // Load the user's existing drafts so the tree indicators are correct on first render.
  useEffect(() => {
    if (!selectedRepo) {
      return;
    }

    let cancelled = false;

    async function loadDrafts() {
      const res = await fetch(
        `/api/drafts?repo=${encodeURIComponent(selectedRepo!)}`
      );
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
  }, [selectedRepo]);

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
    <>
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          ShareMD
        </h1>
        <UserMenu installUrl={reposData?.installUrl} />
      </header>

      <div className="flex flex-1 min-h-0">
        <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 flex flex-col">
          <RepoPicker
            repos={reposData?.repos ?? []}
            loading={reposLoading}
            error={reposError}
            installUrl={reposData?.installUrl}
            selectedRepo={selectedRepo}
            onSelect={setSelectedRepo}
          />
          {selectedRepo && (
            <FileBrowser
              repo={selectedRepo}
              onFileSelect={setSelectedFile}
              selectedFile={selectedFile}
              pendingFiles={pendingFiles}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {selectedFile && selectedRepo ? (
            <MarkdownEditor
              key={`${selectedRepo}:${selectedFile}`}
              repo={selectedRepo}
              filePath={selectedFile}
              onPendingChange={setPending}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <div className="text-center">
                <p className="text-lg mb-1">Select a file to edit</p>
                <p className="text-sm">
                  Choose a markdown file from the file browser
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
