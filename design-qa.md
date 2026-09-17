# Design QA — Mobile authentication refinement

## Comparison target

- Source visual truth: `C:\Users\emper\.codex\codex-remote-attachments\01a0aef5-d60e-7641-adc4-fadbc8de8225\0278347C-6B08-44BD-B2B4-4CE452142423\1-Photo-1.jpg` (590 × 1280).
- Intended state: signed-out dark-mode SharedNotes sign-in screen on iPhone Safari.
- Implementation: local SharedNotes authentication route after the mobile CSS refinement.

## Findings and fixes

- [P1] The heading was near-black against a dark card.
  - Fix: added an explicit dark-mode heading color.
- [P1] The card used the broad desktop rhythm and could crowd Safari's bottom controls.
  - Fix: constrained the card, adjusted its padding and vertical spacing, and made the screen safe-area and dynamic-viewport aware.
- [P2] iOS autofill rendered the email field with a bright yellow fill.
  - Fix: added dark-theme WebKit autofill styling to retain the input's dark surface and readable text.
- [P2] Mobile email entry could apply unwanted casing/correction.
  - Fix: disabled autocapitalization and autocorrect on the email control.

## Required fidelity surfaces

- Fonts and typography: the display heading remains the product's existing typeface; its dark-mode contrast is now explicit.
- Spacing and layout rhythm: mobile padding, card width, and control heights now use the iOS safe area and mobile viewport.
- Colors and visual tokens: dark background, card, fields, and WebKit autofill share the same dark token family.
- Image and icon fidelity: no image asset changes were needed; the existing brand mark is preserved.
- Copy and content: existing product copy is preserved.

## Verification

- `npm run build` passed.
- `npm run test:smoke` passed, including second-device sync against one server database.
- Visual browser capture is blocked: the available `localhost:5173` preview is already signed in, and changing it to signed-out would alter the user's active local session. The alternate local address is mapped to an unrelated component preview, so it cannot provide equivalent evidence.

## Final result

blocked
