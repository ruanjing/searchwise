# GrowthVault Design

## Purpose

GrowthVault is a local-first Chrome extension for operators, marketers, and indie makers who collect growth material while browsing. It helps users save useful competitor copy, positioning, pricing notes, user comments, launch examples, and content ideas, then turn those saved clips into structured Markdown outputs.

The first version should prove a simple loop:

1. Save useful material from any page.
2. Organize it by project and material type.
3. Generate reusable Markdown from built-in templates.

GrowthVault is not an AI writing tool in version one. It is not an auto-posting tool, scraper, CRM, team workspace, or cloud sync product. Those directions can be evaluated after the core save-organize-export loop is validated.

## Target Users

The first audience is operators, marketers, and indie makers. Their recurring jobs are:

- Research competitor landing pages, stores, communities, and launches.
- Collect user pain points and objections from comments or reviews.
- Save good titles, positioning lines, pricing details, and channel examples.
- Reuse material in launch posts, landing pages, competitor notes, and weekly content planning.

This audience is a better starting point than broad creators because they combine content needs with repeated work and clearer willingness to pay.

## MVP Scope

Version one includes six user-facing capabilities.

### Save Selected Text

When the user selects text on a web page, the context menu shows a save action. Saving captures:

- selected text
- page title
- page URL
- source domain
- save time

The save flow lets the user choose a project, choose a material type, and optionally add a note.

### Save Current Page

When the user clicks the extension icon, the popup lets them save the current page even when no text is selected. This is useful for competitor sites, store listings, launch pages, and community threads.

### Project Management

Clips belong to projects such as `SearchWise`, `DraftWise`, `Competitor Research`, or `Launch Materials`.

If no project exists, the extension creates an `Inbox` project. The save flow also allows quick project creation.

### Material Types

Version one uses a fixed type list:

- Competitor
- Value Proposition
- Pain Point
- User Comment
- Pricing
- Title
- Channel Example
- Idea

Fixed types keep the export templates predictable. Custom types are reserved for a future Pro or post-MVP version.

### Library Page

The library page shows saved clips and supports:

- filtering by project
- filtering by material type
- filtering by source domain
- text search
- editing clip text and notes
- deleting clips
- copying a clip

### Template Export

The export view lets the user choose a project and one built-in template, then generates Markdown that can be copied.

Version one includes four templates:

- Competitor analysis summary
- Launch post draft
- Landing page value proposition list
- User pain point list

Templates are bundled in the extension code. Users cannot create custom templates in version one.

## Out Of Scope

Version one will not include:

- AI generation or summarization
- login or account system
- cloud sync
- payment processing
- team collaboration
- auto-posting
- platform automation
- bulk scraping
- custom templates
- browser-to-browser sync

## Architecture

GrowthVault should use Manifest V3 and keep the implementation small.

### Extension Pieces

- `manifest.json`: declares permissions, pages, background service worker, content script, and context menu behavior.
- Content script: reads selected text and page metadata when the user saves from a page.
- Background service worker: owns context menus, receives save requests, and writes to storage.
- Popup page: quick save current page, choose project and type, open library.
- Library page: manage projects and clips.
- Export page or panel: choose a project/template and generate Markdown.
- Shared storage module: reads and writes projects, clips, and settings through `chrome.storage.local`.
- Shared template module: formats clips into Markdown output.

### Permissions

Start with the smallest useful set:

- `storage`
- `contextMenus`
- `activeTab`
- `scripting` only if needed for selected-text capture from the active page

The extension should avoid broad host permissions in version one. Page access should be user-triggered through the context menu or popup.

### Storage

All data is stored in `chrome.storage.local`. No remote API is called in version one.

```text
Project
- id
- name
- createdAt
- updatedAt

Clip
- id
- projectId
- type
- text
- note
- title
- url
- domain
- createdAt
- updatedAt

Template
- id
- name
- description
- sections
```

Template definitions are static extension data, not user records.

## User Flows

### Selected Text Save

1. User selects text on a page.
2. User right-clicks and chooses `Save to GrowthVault`.
3. Save UI opens with selected text and page metadata.
4. User chooses project and material type.
5. User optionally adds a note.
6. Extension saves the clip locally.
7. User sees a success state.

### Current Page Save

1. User clicks the extension icon.
2. Popup shows current page title, URL, project, and material type.
3. User saves the page.
4. Clip text can be empty or can default to the page title.

### Export

1. User opens the library or export view.
2. User chooses a project.
3. User chooses a built-in template.
4. Extension groups relevant clips by type.
5. Extension generates Markdown.
6. User copies the Markdown.

## Error Handling

- If selected text is too long, show a limit message and ask the user to shorten it. The initial limit should be 10,000 characters.
- If page title is missing, use the domain as a fallback title.
- If the same URL is saved again in the same project, allow it but show a duplicate hint.
- If storage write fails, show a retryable error.
- If the current page cannot be accessed, show a manual-copy fallback message.
- If a project is deleted, ask for confirmation and delete its clips with it.
- If a clip has no project, assign it to `Inbox`.

## Free And Pro Boundary

Version one can ship as a free local-first product. The interface may mention planned Pro capabilities lightly, but it should not require payment or license checks.

Suggested future limits:

- Free: 3 projects, 300 clips, 4 built-in templates.
- Pro: unlimited projects, unlimited clips, custom templates, batch export, AI extraction, cloud sync.

Chrome Web Store payments should not be used. When monetization is added, it should use an external payment and license flow.

## Store Positioning

Initial positioning:

> Save growth ideas from any web page and turn them into launch posts, competitor notes, landing page copy, and pain point lists.

Important trust signals:

- Works locally first.
- No account required for the free version.
- No AI API cost in version one.
- No auto-posting.
- No bulk scraping.
- Minimal permissions.

## Verification

Before release, verify:

- All JavaScript passes `node --check`.
- `manifest.json` parses as valid JSON.
- Locale JSON files parse if localization is included.
- The extension loads unpacked in Chrome or Edge.
- Context menu save works on normal web pages.
- Popup save works on normal web pages.
- Library filters by project, type, and domain.
- Editing, deleting, and copying clips works.
- Export templates generate useful Markdown.
- The extension behaves clearly on restricted pages such as Chrome Web Store or browser internal pages.

Manual test pages should include:

- a competitor landing page
- a community discussion or review page
- an app or extension store listing

## Implementation Notes

Development should reuse patterns already present in the repository's extension projects where practical: small vanilla JavaScript modules, Manifest V3, local storage, low permission surface, and straightforward smoke tests.

The first implementation plan should focus on the complete local loop before styling polish or Pro placeholders.
