# GenForge Live Career Agent — Design Direction

## Direction: the quiet instrument panel

GenForge is a workbench for making careful claims, not a conversational assistant. The visual language is a graphite navigation rail, warm paper-like canvas, hard-edged dividers, and restrained signal colors. It should feel closer to a thoughtful desktop editor than a chat app or a marketing landing page.

## Composition

- Persistent left rail for orientation and progress.
- Central task surface for the current decision.
- Optional right inspector for provenance, privacy, and observable agent activity.
- Cards are used to group decisions, not to turn every element into a floating tile.
- On narrow screens, the inspector becomes a drawer and navigation becomes a compact top row.

## Type and spacing

Use the system sans stack so the interface feels native on macOS and remains legible elsewhere. Headings are compact and declarative. Body copy stays around 65–75 characters per line. Use an 8px base rhythm with small exceptions only when a control needs a larger hit target.

## Color and state

The canvas is warm neutral, the rail is graphite, and ink is near-black. Blue is reserved for selected or actionable state. Green means verified or ready, amber means needs attention, and red means blocked or rejected. Every status also has a label or icon; color is never the only signal. Light and dark appearances use the same semantic roles.

## Interaction principles

- Show the next useful action and its consequence.
- Make live work observable through concise events, never hidden reasoning.
- Keep destructive or irreversible actions explicit.
- Use visible focus rings and preserve keyboard access to all navigation, tabs, forms, drawers, and proof-mode controls.
- Respect reduced motion.

## Anti-patterns deliberately excluded

No gradients, glass panels, decorative AI chat bubbles, oversized hero illustrations, emoji as icons, rainbow status colors, fake activity logs, invented research results, or an unbounded wall of settings.
