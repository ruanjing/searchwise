# GrowthVault

GrowthVault is a local-first Chrome extension for operators, marketers, and indie makers. It saves growth material from web pages, organizes clips by project and type, and exports Markdown from built-in templates.

## MVP

- Save selected text from the right-click menu.
- Save the current page from the popup.
- Organize clips by project and material type.
- Search, filter, edit, delete, and copy clips in the library.
- Export project clips as Markdown using built-in templates.

## Local Install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose "Load unpacked".
4. Select the `growthvault-extension` folder in your current checkout or worktree, for example `F:\demo0422\.worktrees\codex-growthvault\growthvault-extension`.

## Verify

```powershell
node --check growthvault-extension\background\service-worker.js
node --check growthvault-extension\shared\constants.js
node --check growthvault-extension\shared\storage.js
node --check growthvault-extension\shared\templates.js
node --check growthvault-extension\popup\popup.js
node --check growthvault-extension\save\save.js
node --check growthvault-extension\library\library.js
node --check growthvault-extension\export\export.js
node growthvault-extension\tests\manifest-smoke.test.mjs
node growthvault-extension\tests\storage-smoke.test.mjs
node growthvault-extension\tests\templates-smoke.test.mjs
Get-Content growthvault-extension\manifest.json -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
Get-Content growthvault-extension\_locales\en\messages.json -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
Get-Content growthvault-extension\_locales\zh_CN\messages.json -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
```
