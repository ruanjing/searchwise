# GrowthVault Extension

GrowthVault is a vanilla Manifest V3 browser extension for saving growth ideas from any web page and organizing them into practical launch assets. The MVP focuses on capturing selected page text locally, keeping a lightweight idea library, and turning saved snippets into reusable marketing notes.

## MVP Scope

- Save selected growth素材 from web pages through a context menu.
- Store ideas locally with Chrome extension storage.
- Open a popup for quick capture and access.
- Provide a library/options page for reviewing saved ideas.
- Support English and Simplified Chinese extension metadata.

## Local Install

1. Open Chrome and go to `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select the `growthvault-extension` folder in your current checkout or worktree, for example `F:\demo0422\.worktrees\codex-growthvault\growthvault-extension`.

## Verify

Run the manifest smoke test from the repository root:

```powershell
node growthvault-extension\tests\manifest-smoke.test.mjs
```

Expected output:

```text
GrowthVault manifest smoke tests passed
```
