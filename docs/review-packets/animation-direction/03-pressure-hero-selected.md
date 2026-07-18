# Monoskill hero animation — pressure direction selected

## Decision

The context-pressure direction is the new Monoskill homepage hero animation.

The editorial-binding and gravity-convergence directions remain preserved as explorations, but they are not the production direction.

## Why this direction won

- It tells the product story in a literal sequence: 47 separate discovery entries create the flood, every skill visibly travels into an already-present Monoskill package, and the context level falls.
- The package remains physically small throughout. Capability is represented by the 47-cell internal index, not by enlarging Monoskill.
- The final frame provides the key proof: 331 discovery characters, 99% lighter context, and all 47 skills still available.
- Narrated before/during/after captions make the transformation understandable without requiring the metaphor to carry every claim alone.

## Production state

The approved pressure animation has replaced the previous homepage hero mechanism in `website/index.html`, `website/styles.css`, and `website/app.js`.

The homepage version preserves:

- 47 named skill entries;
- the fixed-size Monoskill package;
- lossless 47-cell package fill;
- the 32,817 to 331 context countdown;
- before/during/after narration;
- mobile layout and reduced-motion final state;
- the existing installer generator and analytics behavior.

The three-direction animatic and the nine-frame storyboard remain available as review artifacts. They should not be deleted while iterating.

## Verification

- Production static website build succeeds.
- JavaScript syntax checks succeed.
- 16 Playwright tests pass across desktop and mobile Chromium.
- The live homepage advances from the crowded field to the final cleared state in the in-app browser.

## Remaining boundary

This records the local production implementation. Publishing or deploying the updated homepage remains a separate outward-facing action.
