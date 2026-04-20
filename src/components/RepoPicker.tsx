"use client";

interface AccessibleRepo {
  owner: string;
  repo: string;
  fullName: string;
}

interface RepoPickerProps {
  repos: AccessibleRepo[];
  loading: boolean;
  error: string | null;
  installUrl?: string;
  selectedRepo: string | null;
  onSelect: (repoFullName: string) => void;
}

export default function RepoPicker({
  repos,
  loading,
  error,
  installUrl,
  selectedRepo,
  onSelect,
}: RepoPickerProps) {
  if (loading) {
    return (
      <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-200 dark:border-gray-700">
        Loading repositories…
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-2 text-xs text-red-500 border-b border-gray-200 dark:border-gray-700">
        {error}
      </div>
    );
  }

  if (repos.length === 0) {
    return (
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-400 mb-2">
          No repositories available.
        </p>
        {installUrl && (
          <a
            href={installUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            Install on a repository…
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
      <select
        value={selectedRepo ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full text-xs font-medium bg-transparent text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {!selectedRepo && (
          <option value="" disabled>
            Choose a repository…
          </option>
        )}
        {repos.map((r) => (
          <option key={r.fullName} value={r.fullName}>
            {r.fullName}
          </option>
        ))}
      </select>
      {installUrl && (
        <a
          href={installUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-1 text-xs text-blue-600 hover:underline"
        >
          Add repositories…
        </a>
      )}
    </div>
  );
}
