# Design QA — Desktop workspace cleanup

## Comparison target

- Source visual truth: the supplied desktop references for the compact SharedNotes header, quiet editor header, and sidebar note list.
- Intended state: desktop SharedNotes with account/theme controls in the sidebar footer, no editor toolbar or capture button, and per-note overflow actions.
- Implementation: local production build at `http://localhost:5174/`, reviewed at a 1440 × 900 desktop viewport.

## Findings and fixes

- [P1] Header controls crowded the identity area and editor canvas.
  - Fix: retained only the brand and New Note control in the sidebar header; moved the account button and theme toggle to the lower-left sidebar footer.
- [P1] The editor header contained unrelated navigation, checklist, history, and delete controls.
  - Fix: reduced it to a quiet Notes return control and expanded the editable canvas.
- [P1] The bottom-right Capture action competed with the note canvas.
  - Fix: removed the desktop capture action.
- [P1] Notes had no discoverable per-item edit controls.
  - Fix: added a hover/focus three-dot menu with Add to folder, conditional Remove from folder, and Delete note actions. Folder choices stay within the menu, and the empty-folder state is explicit.

## Visual verification

- Header: desktop preview shows only the SharedNotes mark and New Note control at upper left; account avatar and theme button are placed at lower left.
- Editor: desktop preview shows a clean Notes return header with no right-side tool cluster or Capture control.
- Note actions: opening a note's three-dot menu visibly shows Add to folder and Delete note; the menu expands to folder choices (or the clear "Create a folder first" empty state). Remove from folder is conditionally rendered by the note's folder assignment.
- Layout: the editor now fills the reclaimed right-side space while the sidebar maintains the requested compact hierarchy.

## Automated verification

- `npm run build` passed.
- `npm run test:smoke` passed, including notes, folders, tasks, and second-device synchronization.
- `git diff --check` passed.

## Final result

passed
