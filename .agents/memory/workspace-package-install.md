---
name: Workspace package installs
description: How to add dependencies when the repository uses pnpm workspaces
---

The generic language-package installer runs `pnpm add` at the workspace root and is rejected by pnpm's workspace-root safety check when a dependency belongs to one artifact. Use a package-scoped pnpm add command for that artifact instead, then keep the resulting package manifest and lockfile changes.

**Why:** Adding a server-only dependency to the root would make ownership unclear and can fail the workspace's package boundary checks.

**How to apply:** For a dependency used by one artifact, target that package explicitly with pnpm's workspace filter rather than adding it to the root.