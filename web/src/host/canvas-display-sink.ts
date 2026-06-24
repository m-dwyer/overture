// The OLED display sink: binds the emulator's 1-bit draw ops to a 2D canvas. Pulled
// out of App.tsx so the device-pixel render path is a plain, unit-testable module
// with no React. value 0 = black (BG), nonzero = white (FG) — monochrome Move OLED.
import type { DisplaySink } from "./sinks";
import { DEVICE_FONT } from "./device-font";

// Real Move OLED: monochrome white pixels on black.
const FG = "#f2f2f2";
const BG = "#000000";
// The device's `print` font is a 5×7 bitmap on a fixed 6px-wide grid; the tool
// stacks menu rows only 9px apart (menu_layout LIST_LINE_HEIGHT) and right-aligns
// values using text_width = chars × 6. Match that so text doesn't overlap and
// alignment lands correctly. The sink multiplies all of these (coords, sizes) by
// the active OLED scale: every logical device pixel becomes a scale×scale block.
const CHAR_W = 6;
// Smooth ("Sharp"/readable) text path only: the device font rendered with the
// browser's anti-aliased system font, supersampled, for a legible on-screen view.
// ~8px keeps glyphs inside the 9px line height.
const FONT_PX = 8;
const FONT_FAMILY = "ui-monospace, 'SF Mono', Menlo, monospace";
// Readable default supersamples the 128×64 device buffer 8× (1024×512 backing):
// graphics stay crisp scale-blocks and print() text renders anti-aliased and
// legible. Exact mode (scale 1) reproduces the literal device pixels with
// nearest-neighbor CSS upscaling.
export const OLED_READABLE_SCALE = 8;

/**
 * Build a DisplaySink that draws onto `canvas`. `getScale` and `getSmooth` are read
 * live on every op so the readable⇄exact toggle takes effect on the next tick without
 * a rebuild. Graphics are always crisp integer blocks; only text has two paths —
 * `getSmooth()` true → the legible anti-aliased "Sharp" view for the browser; false
 * → true 1-bit device glyphs (deterministic, hardware-faithful) for "Exact" + tests.
 */
export function createCanvasDisplaySink(
  canvas: HTMLCanvasElement,
  getScale: () => number,
  getSmooth: () => boolean
): DisplaySink {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("createCanvasDisplaySink: 2D context unavailable");

  const shade = (v: number | boolean): string => (v ? FG : BG);

  // Mirror the current OLED frame's printed text into a global so tests can assert
  // what the screen actually says (e.g. the manual generator checks a figure landed
  // on "DELAY"/"STEP EDIT"). A draw-order join is enough for substring checks; reset
  // each frame on clearScreen. Observability, not app logic.
  let oledFrame: string[] = [];
  const publishOled = () => {
    globalThis.__OVT_OLED_TEXT = oledFrame.join(" ");
  };

  return {
    clearScreen() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      oledFrame = [];
      publishOled();
    },
    fillRect(x, y, w, h, v) {
      const s = getScale();
      ctx.fillStyle = shade(v);
      ctx.fillRect((x | 0) * s, (y | 0) * s, Math.max(0, w | 0) * s, Math.max(0, h | 0) * s);
    },
    drawRect(x, y, w, h, v) {
      const s = getScale();
      ctx.fillStyle = shade(v);
      const X = (x | 0) * s,
        Y = (y | 0) * s,
        W = Math.max(0, w | 0) * s,
        H = Math.max(0, h | 0) * s;
      ctx.fillRect(X, Y, W, s);
      ctx.fillRect(X, Y + H - s, W, s);
      ctx.fillRect(X, Y, s, H);
      ctx.fillRect(X + W - s, Y, s, H);
    },
    setPixel(x, y, v) {
      const s = getScale();
      ctx.fillStyle = shade(v);
      ctx.fillRect((x | 0) * s, (y | 0) * s, s, s);
    },
    print(x, y, text, color) {
      const s = getScale();
      const str = String(text);
      // Both paths draw on the device's fixed 6px-per-char grid (monospace, no
      // kerning) so spacing and text_width-based alignment match the firmware font.
      const baseX = (x | 0) * s;
      const baseY = (y | 0) * s;
      ctx.fillStyle = color === 0 ? BG : FG;
      if (getSmooth()) {
        // "Sharp"/readable: anti-aliased system font, supersampled — legible on screen.
        ctx.font = `${FONT_PX * s}px ${FONT_FAMILY}`;
        ctx.textBaseline = "top";
        for (let i = 0; i < str.length; i++) ctx.fillText(str[i], baseX + i * CHAR_W * s, baseY);
      } else {
        // "Exact": the literal device 5×7 glyphs as 1-bit s×s blocks. No fillText, no
        // anti-aliasing → byte-stable and pixel-identical to the hardware OLED.
        for (let i = 0; i < str.length; i++) {
          const rows = DEVICE_FONT[str[i]];
          if (!rows) continue;
          const cx = baseX + i * CHAR_W * s;
          for (let row = 0; row < rows.length; row++) {
            const bits = rows[row];
            for (let col = 0; col < bits.length; col++) {
              if (bits[col] === "1") ctx.fillRect(cx + col * s, baseY + row * s, s, s);
            }
          }
        }
      }
      if (str.trim()) {
        oledFrame.push(str);
        publishOled();
      }
    },
    textWidth(text) {
      return String(text).length * CHAR_W;
    },
    flush() {
      /* drawn eagerly */
    },
  };
}
