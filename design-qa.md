# Design QA — Mobile note actions and capture

## Comparison target

- Source visual truth: the supplied mobile delete-swipe, note-action menu, and compact-header screenshots.
- Implementation evidence: browser-rendered local production preview at `http://localhost:5174/`.
  - Desktop: 1440 × 900 CSS pixels, DPR 1, authenticated note-list and open-menu states.
  - Mobile: 390 × 844 CSS pixels, DPR 1, authenticated note-list and bottom-navigation states.
- Normalization: the supplied image is a focused sidebar crop, so the comparison used the same note-row/menu region rather than browser chrome or unrelated canvas space.

## Desktop frame comparison

- Source visual truth: `C:\Users\emper\AppData\Local\Temp\codex-clipboard-5305a886-0249-404c-8e34-75f648b050b7.png` — dark dashboard presented as a rounded application window above a darker outer page.
- Implementation evidence: browser-rendered production preview at `http://localhost:5175/`, captured at 1280 × 720 CSS pixels, DPR 1, in dark theme with an authenticated empty note and then the existing To-do tab active.
- Normalization: compared the editor region only; browser chrome, the reference dashboard's unrelated project controls, and the product's existing left navigation were excluded. The target effect is a rounded right-side workspace with a narrow exposed background gutter.
- Full-view evidence: the implementation retains the pre-existing full-height Notes sidebar and places the original editor canvas in its own 17px-radius framed surface with a dark outer gutter and subtle deep shadow. Both existing tabs remained usable.
- Focused-region evidence: the editor's top-left frame corner, border, sidebar division, and empty canvas were inspected at the same rendered size. No new content card, heading, or tab was introduced.

## Findings and fixes

- [P1] The first desktop pass applied the inset-window treatment to the left navigation as well as the workspace.
  - Fix: restored the navigation as a full-height menu surface and constrained the rounded border, dark outer gutter, and elevation to the editor/reminders canvas on the right.
- [P1] The editor frame still left a black gutter at the right and bottom edges, while the sidebar could shift its account controls during long-list scrolling.
  - Fix: matched the surrounding canvas to the menu surface, extended the right workspace flush to the right/bottom edge, and constrained scrolling to the note/task list so the account and theme controls remain pinned in the sidebar footer.

- [P1] The delete swipe showed a colored rail but its action icon was obscured by the note controls.
  - Fix: the revealed Delete/Folder controls now mount in their own fixed interaction layer, with visible Lucide icons and high-contrast semantic rails.
- [P1] Swipe actions routed into the long-press dropdown instead of a focused follow-up action.
  - Fix: swiping left opens a deletion confirmation; swiping right opens a folder picker. These dialogs remain on the notes surface and never change tabs.
- [P1] The mobile long-press menu could be clipped by the scrolling note list and had inconsistent icon/text columns.
  - Fix: mounted the menu above the pressed note outside the scroll container, and aligned leading icons/text/chevron. The added folder leading icon is mobile-only; desktop keeps its original compact menu composition.
- [P2] Mobile retained a duplicate header create button and the bottom capture button always initiated note capture.
  - Fix: hid the mobile header button. The bottom control now opens a new note from Notes and a New Reminder dialog from To-do.
- [P1] The revised swipe treatment stopped the note card from moving naturally while revealing its action rail.
  - Fix: restored the smooth 82px left/right card translation, preserving the original red Delete and green Folder reveal animation with visible action icons.
- [P2] The mobile Add to folder row retained an unnecessary trailing disclosure icon.
  - Fix: removed that trailing icon at the mobile breakpoint only; the desktop menu remains unchanged.
- [P1] The restored swipe animation still painted the row itself as well as the reveal layer, leaving a duplicate color strip on the opposite edge.
  - Fix: the note row is now transparent during the gesture. Only the action layer is colored, so Folder exposes one left rail and Delete exposes one right rail.
- [P1] Swipe labels were mounted in a fixed screen layer, so they could drift into another note; the Delete layer also inherited a generic 36px control style.
  - Fix: action buttons now live inside their own swipe row, and the Delete rail has an isolated class. The note list clips horizontal overflow, keeping both rails inside the viewport.

- [P1] Desktop search displayed the platform shortcut badge and the editor repeated the folder location.
  - Fix: hid the shortcut badge and canvas folder selector at the desktop breakpoint only.
- [P1] The desktop note timestamp and overflow action needed a clearer vertical relationship, while menu icons were inconsistently aligned.
  - Fix: right-aligned the time, retained the ellipsis below it, and aligned Share, folder, delete, and chevron icons within the menu.
- [P1] Mobile swipe-left did not visibly communicate deletion and the canvas retained sync chrome.
  - Fix: gave the Delete rail a persistent semantic-red surface and high-contrast trash icon while active; removed the mobile-only sync label/indicator.
- [P2] The mobile navigation bar sat slightly too high.
  - Fix: lowered it within the safe area without changing desktop positioning.

## Visual verification

- Desktop frame capture confirms the corrected composition: the rounded, bordered surface is limited to the right workspace, while the left navigation stays outside it and the original Notes/To-do navigation remains intact.
- Desktop sidebar scroll capture confirms the note list scrolls independently while the avatar and appearance toggle stay fixed in the footer; the workspace reaches the right and bottom viewport edges without a contrasting gutter.
- Desktop capture confirms the search field no longer has a keyboard badge, Folder/Inbox is absent from the canvas, timestamps are right-aligned, and all note-menu icons share a consistent leading edge.
- Mobile capture at 390 × 844 confirms the header add button is absent, the navigation capture action is context-aware, and the sync indicator is absent. The mobile folder selector remains intentionally available; the desktop-only canvas change does not leak to mobile.
- Both swipe rails were exercised in the rendered browser: left exposed a red trash/Delete control and opened the confirmation dialog; right exposed a green Folder control and opened the folder picker. The no-folder state was also checked.
- The restored swipe animation was compared directly at 390 × 844: the selected card now slides over a full semantic rail in the direction of the gesture, rather than being clipped in place. The Delete and Folder icons remain visible and centered in their rails.
- A follow-up mobile capture confirms the reveal has no opposite-edge color artifact: Folder has one clean green left rail; Delete has one clean red right rail.
- Final mobile capture confirms Folder and Delete stay vertically aligned with the note that produced them, including after the list moves; there is no horizontal scrollbar.
- The mobile action menu opens above its selected note, with Share, Add to folder, and Delete icon/text rows aligned; Add to folder has no trailing chevron on mobile.

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
