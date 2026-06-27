# Device Smoke Checklist

Run this only for changes the emulator cannot prove: device deployment,
QuickJS/runtime behavior, real Move/Schwung host behavior, physical controls,
OLED/LED hardware, or real audio routing.

## Before Launch

- Build and deploy the active tool with `mise run tool-deploy`.
- Fully restart the tool/device runtime after JS bundle changes with `mise run device-restart`.
- Check Schwung/device logs for new JavaScript or host errors.

## Smoke Pass

- Launch Overture and confirm the splash gives way to Track View.
- Confirm OLED rendering is nonblank and button/pad LEDs update.
- Select Track 5 and play pads. A Schwung-routed module should sound.
- Start transport on a Track 5 clip with active steps. Notes should have audible gates, not zero-length clicks or silence.
- Stop transport. Notes should release; no stuck notes.
- Switch between Track 1 and Track 5. Move-routed and Schwung-routed tracks should keep their expected routing.
- Exercise any newly changed hardware gesture once on the physical controls.
- If a change touched deploy/package code, relaunch after suspend/exit and confirm the installed module still boots.

Keep this checklist short. If a check becomes deterministic in the emulator,
move it into automated coverage instead of expanding this file.
