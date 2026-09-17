# Design QA — Note actions and mobile navigation

## Comparison target

- Source visual truth: [codex-clipboard-07d16ce6-8736-4007-81fb-884cd0dbd282.png](C:\Users\emper\AppData\Local\Temp\codex-clipboard-07d16ce6-8736-4007-81fb-884cd0dbd282.png), 469 × 216 pixels. It establishes the dark sidebar note-row and overflow-menu treatment.
- Implementation evidence: browser-rendered local production preview at `http://localhost:5174/`.
  - Desktop: 1440 × 900 CSS pixels, DPR 1, authenticated note-list and open-menu states.
  - Mobile: 390 × 844 CSS pixels, DPR 1, authenticated note-list and bottom-navigation states.
- Normalization: the supplied image is a focused sidebar crop, so the comparison used the same note-row/menu region rather than browser chrome or unrelated canvas space.

## Findings and fixes

- [P1] Desktop overflow menus remained open when users clicked elsewhere.
  - Fix: document-level pointer handling now dismisses the menu and its folder chooser on any outside click; Escape also clears them.
- [P1] The three-dot control competed with the timestamp.
  - Fix: placed it on the line below the timestamp on desktop and mobile.
- [P1] Notes had no sharing affordance.
  - Fix: added Share note, which currently copies the title and full note body to the clipboard and confirms the result with a toast.
- [P1] Mobile lacked note-level action access and retained desktop utility controls.
  - Fix: added mobile overflow menus and long-press access; swipe-left reveals a Delete action and swipe-right reveals a Folder action. Removed the mobile avatar/theme controls.
- [P2] The mobile capture control floated above the other navigation controls and nav labels made the bar too busy.
  - Fix: aligned the centered capture control with its peers, made the navigation icon-only, and added press/transition motion.

## Visual verification

- Full view: desktop and mobile browser captures show the dark workspace, compact note rows, and a balanced icon-only mobile navigation bar.
- Focused region: the desktop open-menu capture confirms Share note, Add to folder, and Delete note; the ellipsis sits below the timestamp. Clicking outside the menu removed it in the rendered browser.
- Mobile capture confirms the overflow controls remain available, avatar/theme controls are absent, and the central capture icon shares the same baseline as the other icons.
- Gesture note: browser automation provides mouse dragging rather than a touch pointer, so swipe and long-press were verified from their rendered action surfaces and pointer-event implementation; device-touch behavior remains a final on-device check.

## Fidelity surfaces

- Fonts and typography: existing Manrope and DM Mono treatment is retained; compact menu and time typography preserve the reference hierarchy.
- Spacing and layout rhythm: the timestamp/ellipsis stack, menu spacing, touch-action rail width, and nav baseline were reviewed at their target breakpoints.
- Colors and visual tokens: the existing neutral dark surfaces remain intact; destructive and folder swipe rails use restrained semantic red and green.
- Image quality and asset fidelity: no raster assets are part of this interaction target; existing Lucide controls are used consistently with the product.
- Copy and content: menu wording is explicit—Share note, Add to folder, Remove from folder when applicable, and Delete note.

## Automated verification

- `npm run build` passed.
- `npm run test:smoke` passed, including notes, folders, tasks, and second-device synchronization.
- Browser console check: no errors in the local rendered preview.
- `git diff --check` passed.

## Follow-up polish

- Test long-press and swipe thresholds on a physical iPhone after deployment; no blocking visual or functional issue is known.

## Final result

passed
