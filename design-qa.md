# Design QA — Mobile note actions and capture

## Comparison target

- Source visual truth: the supplied mobile delete-swipe, note-action menu, and compact-header screenshots.
- Implementation evidence: browser-rendered local production preview at `http://localhost:5174/`.
  - Desktop: 1440 × 900 CSS pixels, DPR 1, authenticated note-list and open-menu states.
  - Mobile: 390 × 844 CSS pixels, DPR 1, authenticated note-list and bottom-navigation states.
- Normalization: the supplied image is a focused sidebar crop, so the comparison used the same note-row/menu region rather than browser chrome or unrelated canvas space.

## Findings and fixes

- [P1] The delete swipe showed a colored rail but its action icon was obscured by the note controls.
  - Fix: the revealed Delete/Folder controls now mount in their own fixed interaction layer, with visible Lucide icons and high-contrast semantic rails.
- [P1] Swipe actions routed into the long-press dropdown instead of a focused follow-up action.
  - Fix: swiping left opens a deletion confirmation; swiping right opens a folder picker. These dialogs remain on the notes surface and never change tabs.
- [P1] The mobile long-press menu could be clipped by the scrolling note list and had inconsistent icon/text columns.
  - Fix: mounted the menu above the pressed note outside the scroll container, and aligned leading icons/text/chevron. The added folder leading icon is mobile-only; desktop keeps its original compact menu composition.
- [P2] Mobile retained a duplicate header create button and the bottom capture button always initiated note capture.
  - Fix: hid the mobile header button. The bottom control now opens a new note from Notes and a New Reminder dialog from To-do.

- [P1] Desktop search displayed the platform shortcut badge and the editor repeated the folder location.
  - Fix: hid the shortcut badge and canvas folder selector at the desktop breakpoint only.
- [P1] The desktop note timestamp and overflow action needed a clearer vertical relationship, while menu icons were inconsistently aligned.
  - Fix: right-aligned the time, retained the ellipsis below it, and aligned Share, folder, delete, and chevron icons within the menu.
- [P1] Mobile swipe-left did not visibly communicate deletion and the canvas retained sync chrome.
  - Fix: gave the Delete rail a persistent semantic-red surface and high-contrast trash icon while active; removed the mobile-only sync label/indicator.
- [P2] The mobile navigation bar sat slightly too high.
  - Fix: lowered it within the safe area without changing desktop positioning.

## Visual verification

- Desktop capture confirms the search field no longer has a keyboard badge, Folder/Inbox is absent from the canvas, timestamps are right-aligned, and all note-menu icons share a consistent leading edge.
- Mobile capture at 390 × 844 confirms the header add button is absent, the navigation capture action is context-aware, and the sync indicator is absent. The mobile folder selector remains intentionally available; the desktop-only canvas change does not leak to mobile.
- Both swipe rails were exercised in the rendered browser: left exposed a red trash/Delete control and opened the confirmation dialog; right exposed a green Folder control and opened the folder picker. The no-folder state was also checked.
- The mobile action menu opens above its selected note, with Share, Add to folder, and Delete icon/text rows aligned.

## Fidelity surfaces

- Fonts and typography: existing Manrope and DM Mono treatment is retained; compact menu and time typography preserve the reference hierarchy.
- Spacing and layout rhythm: timestamp/ellipsis stacking, menu icon columns, and the mobile nav baseline were reviewed at their target breakpoints.
- Colors and visual tokens: the existing neutral dark surfaces remain intact; destructive and folder swipe rails use distinct semantic red and green.
- Image quality and asset fidelity: no raster assets are part of this interaction target; existing Lucide controls are used consistently with the product.
- Copy and content: menu wording is explicit—Share note, Add to folder, Remove from folder when applicable, and Delete note.

## Automated verification

- `npm run build` passed.
- `npm run test:smoke` passed, including notes, folders, tasks, and second-device synchronization.
- Browser interactions passed without application errors. One browser-automation-only `prompt()` limitation was logged when attempting the existing native folder-creation prompt; it is not part of the updated swipe/menu/capture flow.
- `git diff --check` passed.

## Follow-up polish

- Test the swipe threshold and native folder-creation prompt on a physical iPhone after deployment; no blocking visual or functional issue is known.

## Final result

passed
