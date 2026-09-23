# keel components

Ported from the [keel](https://github.com/) design system monorepo at
`/home/oliviodev/Software_Development/keel` (`apps/desktop/src/renderer/components/ui/*`),
copied at keel commit `79a7958`, on 2026-09-23.

keel's primitives are built on **@base-ui/react** (Base UI) instead of Radix, which is why
this frontend now has two coexisting primitive systems on purpose:

- `src/components/atoms/*` — shadcn-over-**Radix** (existing screens, unchanged).
- `src/components/keel/*` — shadcn-over-**Base UI** (login, app shell/sidebar, student flow).

Do not migrate the rest of the app to keel components without a deliberate follow-up decision —
this split is intentional, not a work-in-progress state.

## Files ported this slice

`button`, `badge`, `input`, `label`, `separator`, `skeleton`, `spinner`, `progress`, `field`,
`card`, `item`, `empty`, `sheet`, `input-otp`, `steps`, `input-group`, `textarea` (transitive dep
of `input-group`), `tooltip`, `portal-container` (transitive dep of `tooltip`), `sidebar`.

## Import path changes made on port

- `@/components/ui/*` → `@/components/keel/*`
- `@/lib/utils` and `@/hooks/use-mobile` needed no changes — this repo already has both at the
  same paths keel expects (`src/lib/utils.ts` exporting `cn`, `src/hooks/use-mobile.tsx` exporting
  `useIsMobile`).

## New dependencies added for this port

- `@base-ui/react@1.5.0` — pinned to the exact version keel has resolved in its lockfile
  (`apps/desktop/pnpm-lock.yaml`), not latest (1.8.0 at the time of writing), to avoid API drift
  since several ported files use `@base-ui/react/use-render` and `@base-ui/react/merge-props`
  subpath exports.
- `radix-ui@1.5.0` (the unified package) — `button.tsx` and `badge.tsx` import `Slot` from it
  (`Slot.Root`), which is a different export shape than the `@radix-ui/react-slot` package this
  frontend already had installed for the Radix atoms. Also pinned to keel's resolved version.

## Design tokens added

`src/index.css` gained the `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`,
`--sidebar-primary-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground`,
`--sidebar-border`, `--sidebar-ring` tokens (light + dark), reusing this project's existing
palette (mapped onto card/foreground/primary/muted/border/ring) rather than importing keel's own
theme. No other tokens were touched.

## Known gap (not fixed in this port)

`input-otp.tsx`'s fake caret uses `animate-caret-blink`. Neither this project nor keel defines
that keyframe via a wired Tailwind plugin (`tailwindcss-animate` is a dependency here but is not
registered via `@plugin` in `src/index.css`, Tailwind v4 CSS-first config). This was already the
case for the existing `src/components/atoms/input-otp.tsx`, so this port does not regress
anything — the blinking caret animation silently no-ops the same way it already did. Fixing it
means wiring `@plugin "tailwindcss-animate";` app-wide, which is out of scope for this slice.

## Rule

Fixes to these components belong **upstream in keel first**, then get re-ported here. Do not
patch bugs directly in `src/components/keel/*` without also fixing/discussing them in the keel
repo — otherwise the two copies drift and the next port becomes a merge conflict.
