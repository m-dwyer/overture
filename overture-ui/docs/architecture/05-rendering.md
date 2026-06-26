# Rendering

Rendering should move toward clearer presentation models and adapter-owned host
writes where that removes real test or ownership pain. Overture should not
convert every renderer to retained frames as a blanket migration.

## Current Rendering Critique

OLED routing is a priority ladder over `S`. LED rendering is separate and more hardware-adapter-like, but it also owns presentation rules, cache invalidation, palette handling, and co-run reclaim. This makes rendering hard to test because expected output is often visible only as host calls.

The current design has two strengths to preserve:

- OLED redraw is conditional and cheap when nothing changes.
- LED output is cached and hardware-aware.

The target architecture should keep those strengths while making desired output explicit.

## Render Model

Renderers should receive a read-only model derived from app state, DSP mirror state, runtime state, and active contexts.

```ts
interface RenderModel {
  app: AppRenderState;
  dsp: DspRenderState;
  runtime: RuntimeRenderState;
  contexts: ContextRenderState[];
  hardware: HardwareRenderCaps;
}
```

This model should be built in one place only when a surface needs it. Existing
render modules may continue to draw through the Render Surface while Page,
modal, and component renderers converge on smaller presentation models.

## Screen Frames

Screen frames are an optional tool for surfaces where host-call tests are too
noisy or ownership needs to be explicit.

Frames can be immediate drawing commands rather than a full retained scene graph, but they should be testable data before host flush.

```ts
interface ScreenFrame {
  id: string;
  clear: boolean;
  ops: ScreenDrawOp[];
}
```

Examples of draw operations:

- text
- line
- rect
- filled rect
- meter
- icon
- clipped text

The host screen adapter translates these ops to `print`, `fill_rect`, `clear_screen`, and related primitives.

## LED Frames

LED frames are also optional. The first LED priority is to isolate cache,
palette, forced resend, initialization, and co-run reclaim behavior behind an
adapter boundary.

```ts
interface LedFrame {
  noteLeds: Map<number, LedColor>;
  buttonLeds: Map<number, LedColor>;
  knobLeds: Map<number, LedBrightness>;
  palette?: PalettePatch;
  ownership: LedOwnership;
}
```

The LED adapter owns:

- last-sent caches
- forced resend
- palette programming
- initialization queue
- `LEDS_PER_FRAME`
- co-run suppression and reclaim

Feature renderers decide meaning. The adapter decides how to write hardware safely.

## Context Rendering

Render routing should follow context ownership:

1. If a top context captures the screen, render it.
2. Otherwise render base context screen.
3. Apply overlays in priority order if they are partial.
4. Produce LED contributions from base context and active contexts.
5. Resolve LED ownership conflicts.
6. Flush diffs through adapters.

This replaces hidden priority ladders with declared capture policy.

## Dirty and Invalidation

Replace a single broad `screenDirty` flag with scoped invalidation:

- `screen`
- `pads`
- `buttons`
- `knobs`
- `palette`
- `allLeds`
- `context`

Legacy `forceRedraw()` can initially map to broad invalidation. New workflows should specify the smallest useful scope.

## Rendered Screens and LEDs Pattern Critique

The template `ScreenFrame` and `LedFrame` are good ideas but too small:

- Screen frames need drawing operations, clipping, and stable dimensions.
- LED frames need Move-specific note/button/knob surfaces.
- Frames need ownership metadata for co-run.
- Hardware adapters need caching and initialization policy.

Overture should implement frames as hardware-specific render contracts, not generic UI objects.

## Migration Path

1. Keep Render Surface as the main host drawing boundary.
2. Strengthen Parameter Page and modal presentation models before adding frames.
3. Add a `ScreenFrame` only for a simple context-owned modal if it simplifies
   tests or deletes noisy host spies.
4. Move LED caches and palette logic behind an adapter interface before
   considering `LedFrame`.
5. Do not do blanket ScreenFrame or LedFrame conversion.
