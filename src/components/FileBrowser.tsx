"use client";

import { useState, useEffect, useCallback } from "react";

interface FileEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  sha: string;
}

interface DirectoryConfig {
  path: string;
  label: string;
}

interface FileBrowserProps {
  repo: string;
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
  pendingFiles: Set<string>;
}

function FolderIcon({ open }: { open: boolean }) {
  return <span className="mr-1.5 text-sm">{open ? "📂" : "📁"}</span>;
}

function FileIcon() {
  return <span className="mr-1.5 text-sm">📄</span>;
}

function TreeNode({
  repo,
  entry,
  depth,
  onFileSelect,
  selectedFile,
  pendingFiles,
}: {
  repo: string;
  entry: FileEntry;
  depth: number;
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
  pendingFiles: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadChildren = useCallback(async () => {
    if (children.length > 0) {
      return;
    }
    setLoading(true);
    const res = await fetch(
      `/api/files?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(entry.path)}`
    );
    const data = await res.json();
    setChildren(data);
    setLoading(false);
  }, [repo, entry.path, children.length]);

  const handleClick = async () => {
    if (entry.type === "dir") {
      if (!expanded) {
        await loadChildren();
      }
      setExpanded(!expanded);
    } else {
      onFileSelect(entry.path);
    }
  };

  const isSelected = selectedFile === entry.path;
  const isPending = entry.type === "file" && pendingFiles.has(entry.path);

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full text-left px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center ${
          isSelected ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : ""
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {entry.type === "dir" ? <FolderIcon open={expanded} /> : <FileIcon />}
        <span className="truncate flex-1">{entry.name}</span>
        {isPending && (
          <span
            className="w-2 h-2 rounded-full bg-amber-500 ml-2 flex-shrink-0"
            title="Unpublished draft changes"
          />
        )}
      </button>
      {expanded && (
        <div>
          {loading && (
            <div
              className="text-xs text-gray-400 py-1"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              Loading...
            </div>
          )}
          {children.map((child) => (
            <TreeNode
              key={child.path}
              repo={repo}
              entry={child}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
              pendingFiles={pendingFiles}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileBrowser({
  repo,
  onFileSelect,
  selectedFile,
  pendingFiles,
}: FileBrowserProps) {
  const [roots, setRoots] = useState<DirectoryConfig[]>([]);
  const [rootEntries, setRootEntries] = useState<Record<string, FileEntry[]>>({});
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await fetch(`/api/config?repo=${encodeURIComponent(repo)}`);
        if (!res.ok) {
          setError(`Config failed: ${res.status} ${await res.text()}`);
          setLoading(false);
          return;
        }
        const config = await res.json();
        setRoots(config.directories ?? []);

        const entries: Record<string, FileEntry[]> = {};
        for (const dir of config.directories ?? []) {
          const dirRes = await fetch(
            `/api/files?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(dir.path)}`
          );
          if (!dirRes.ok) {
            console.error(`Failed to load ${dir.path}: ${dirRes.status}`);
            continue;
          }
          entries[dir.path] = await dirRes.json();
        }
        setRootEntries(entries);
      } catch (e) {
        setError(`Error: ${e}`);
      }
      setLoading(false);
    }
    loadConfig();
  }, [repo]);

  if (loading) {
    return (
      <div className="p-4 text-sm text-gray-500">Loading file tree...</div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-500">{error}</div>
    );
  }

  if (roots.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
        <p className="mb-2">No directories configured.</p>
        <p>
          Add a <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">.sharemd.yaml</code> file
          to the root of this repo to get started:
        </p>
        <pre className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">{`directories:
  - path: docs/
    label: Documentation`}</pre>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {roots.map((root) => (
        <div key={root.path} className="mb-2">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            {root.label}
          </div>
          {(rootEntries[root.path] ?? []).map((entry) => (
            <TreeNode
              key={entry.path}
              repo={repo}
              entry={entry}
              depth={0}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
              pendingFiles={pendingFiles}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
