# Overture Quick Start

This is the shortest path to a useful hybrid setup: Move engines on tracks 1-4,
Schwung/open engines on tracks 5-8, and one Overture timeline controlling both.

## 1. Prepare Move tracks 1-4

On Move, create or open a Set with the four native tracks you want Overture to
sequence.

- Track 1 receives MIDI channel 1.
- Track 2 receives MIDI channel 2.
- Track 3 receives MIDI channel 3.
- Track 4 receives MIDI channel 4.
- Leave Move's own transport stopped when sequencing from Overture.
- Pick the Move presets/devices in Move's native UI first; Overture can enter
  native sound editing with Edit Sound, but route diagnosis is still manual until
  the Route Check phase lands.

Overture drives these tracks by MIDI injection into the running Move engine. It
does not replace MoveOriginal.

## 2. Prepare Schwung tracks 5-8

Install or keep the Schwung modules you want available in the bundled Schwung
slots.

- Track 5 is the first open/Schwung route and is expected on channel 5.
- Track 6 is expected on channel 6.
- Track 7 is expected on channel 7.
- Track 8 is expected on channel 8.
- Load a sound generator into each Schwung slot you want to play.
- Avoid leaving a slot in thru mode if you expect Overture to own that track's
  sound.

The exact slot-status screen is a later roadmap phase. For now, confirm the slot
manually in Schwung's chain editor if a track is silent.

## 3. Select tracks with the side buttons

In Track View, the four side buttons are track buttons.

| Gesture | Result |
|---|---|
| Tap side 1-4 | Select tracks 1-4 |
| Hold Shift + tap side 1-4 | Select tracks 5-8 |
| Shift + jog or Shift + bottom pad | Fallback track selection |

The side-button LEDs show track identity: the active track is solid, and the
other tracks in the current bank are dim.

## 4. Reveal and select clips

Clips are no longer always on the side buttons in Track View.

1. Hold a side button.
2. The 16 step buttons become that track's 16 clips.
3. Tap a step to select or launch that clip.
4. Release the side button to return the steps to pattern editing.

Use Session View for clip launch, copy, cut, clear, scene work, and performance
clip control.

## 5. Edit Sound

Use Edit Sound when you want the native editor for the active route.

- Move-routed tracks enter Move's native device/preset editing UI.
- Schwung-routed tracks enter Schwung's chain editor for the slot.
- Overture keeps the sequencer running while the editor has the OLED and nav
  controls.
- Exit back to Overture with the normal co-run exit gesture.

Current builds may still expose the route-specific labels `Edit Synth...` and
`Edit Slot...`. The roadmap's target label is `Edit Sound...`; the behavior is
already the co-run sound-edit flow.

## 6. Sequence and automate

Overture's wedge is not that Move lacks parameter automation. Move already has
native per-step parameter automation. Overture's wedge is unified depth:

- 8 tracks in one timeline.
- Move engines and Schwung/open tracks under the same sequencer.
- dAVEBOx depth such as trig conditions, automation lanes, polyrhythm, bake, and
  export.
- A single surface grammar for track selection, clip reveal, and sound editing.

For detailed controls, read `docs/MANUAL.md` and `tool/MANUAL.md`.
