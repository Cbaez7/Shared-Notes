# Design QA — Codex-inspired SharedNotes shell (latest pass)

## Comparison target

- Source visual truth: `C:\Users\emper\AppData\Local\Temp\codex-clipboard-a2e894aa-76fc-44c9-8cb6-191989627054.png` (1920 × 1030), informed by the earlier Codex screenshots.
- Implementation: `http://localhost:5173/`, dark-mode Notes view.
- Intended state: desktop shell with left project/history rail, central note workspace, and right reminders panel.

## Evidence

The in-app browser accessibility snapshot confirms the rendered implementation exposes the compact SharedNotes control, theme control, create-note control, search, Notes/To-do tabs, folder tree, note history, sync status, and an avatar-only account button. The browser bridge did not return a screenshot/capture API, so an implementation image could not be put beside the supplied reference. No density normalization was possible. The fixed desktop layout was adjusted in code to a 364px left rail and a 376px widget sitting 116px below the top edge, matching the supplied reference geometry.

## Required fidelity surfaces

- Fonts and typography: implemented with a compact sans interface hierarchy; visual weight and wrapping could not be screenshot-compared.
- Spacing and layout rhythm: implementation uses a 280px history/folder rail, central editor, and 318px reminders rail to mirror the source’s major regions; exact visual measurement is blocked.
- Colors and visual tokens: dark neutral surfaces, quiet borders, and a single purple avatar accent follow the reference direction; screenshot sampling is blocked.
- Image and icon fidelity: no raster imagery is required by this UI. The implementation uses the Lucide icon library rather than handmade icon drawings.
- Copy and content: SharedNotes-specific copy is intentionally retained while the source’s Codex labels are used only as layout inspiration.

## Findings

- [P2] Pixel-level layout comparison is unverified.
  Location: entire desktop shell.
  Evidence: the source screenshots are available, but the in-app browser returned only accessibility content for the local implementation.
  Impact: exact panel widths, type scale, and visual density cannot be accepted as a faithful screenshot match.
  Fix: capture the running `localhost:5173` desktop view through a browser surface that provides screenshots, then compare it directly with the source at the same viewport.

## Primary interaction coverage

- Build passed (`npm run build`).
- Notes/folders/tasks/subtasks sync smoke test passed (`npm run test:smoke`).
- The preview’s accessibility tree confirms the new shell controls are rendered.

## Final result

blocked
