# Getting Started with ShareMD

ShareMD lets you edit markdown files stored in GitHub without needing to know git.

## How it works

1. Sign in with your GitHub account
2. Browse the available documents in the left pane
3. Click a file to open it in the editor
4. Start typing — your changes are saved automatically

## For repo owners

Add a `.sharemd.yaml` file to your repository root to control which directories are available for editing:

```yaml
directories:
  - path: docs/
    label: Documentation
  - path: wiki/
    label: Wiki
```

Only the directories listed here will be visible to editors.
