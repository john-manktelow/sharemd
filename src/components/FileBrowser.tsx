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
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
}

function FolderIcon({ open }: { open: boolean }) {
  return <span className="mr-1.5 text-sm">{open ? "📂" : "📁"}</span>;
}

function FileIcon() {
  return <span className="mr-1.5 text-sm">📄</span>;
}

function TreeNode({
  entry,
  depth,
  onFileSelect,
  selectedFile,
}: {
  entry: FileEntry;
  depth: number;
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const loadChildren = useCallback(async () => {
    if (children.length > 0) {
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/files?path=${encodeURIComponent(entry.path)}`);
    const data = await res.json();
    setChildren(data);
    setLoading(false);
  }, [entry.path, children.length]);

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
        <span className="truncate">{entry.name}</span>
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
              entry={child}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileBrowser({ onFileSelect, selectedFile }: FileBrowserProps) {
  const [roots, setRoots] = useState<DirectoryConfig[]>([]);
  const [rootEntries, setRootEntries] = useState<Record<string, FileEntry[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadConfig() {
      const res = await fetch("/api/config");
      const config = await res.json();
      setRoots(config.directories ?? []);

      const entries: Record<string, FileEntry[]> = {};
      for (const dir of config.directories ?? []) {
        const dirRes = await fetch(`/api/files?path=${encodeURIComponent(dir.path)}`);
        entries[dir.path] = await dirRes.json();
      }
      setRootEntries(entries);
      setLoading(false);
    }
    loadConfig();
  }, []);

  if (loading) {
    return (
      <div className="p-4 text-sm text-gray-500">Loading file tree...</div>
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
              entry={entry}
              depth={0}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
