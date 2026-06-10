# DraftWise

DraftWise is a local-first Chrome extension that starts form draft protection when the user opens the popup on a page, then lets users restore ordinary form drafts after refreshes, crashes, or accidental tab closes.

## MVP

- Starts on the current page after the user clicks the extension.
- Autosaves textarea, text-like input fields, and contenteditable regions on the activated page.
- Skips sensitive fields such as passwords, one-time codes, tokens, card numbers, and hidden/file inputs.
- Stores drafts locally with `chrome.storage.local`.
- Shows restore controls only when saved content exists and the current field is empty.
- Clears drafts for a submitted form.
- Popup controls global autosave, current-site autosave, and draft cleanup.

## Local Install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose "Load unpacked".
4. Select `F:\demo0422\draftwise-extension`.

## Verify

```powershell
node --check draftwise-extension\content\draftwise.js
node --check draftwise-extension\popup\popup.js
node draftwise-extension\tests\manifest-smoke.test.mjs
Get-Content draftwise-extension\manifest.json | ConvertFrom-Json | Out-Null
Get-Content draftwise-extension\_locales\en\messages.json | ConvertFrom-Json | Out-Null
Get-Content draftwise-extension\_locales\zh_CN\messages.json | ConvertFrom-Json | Out-Null
```
