/* Overture boot splash — animated.
 *
 * A 1-bit-native port of the p5.js "OVERTURE" boot animation authored in
 * ~/src/move-boot/src/main.tsx (defaultSketch): an encoder-knob + waveform
 * "signal lock" reveal that resolves into the OVERTURE wordmark.
 *
 * The original p5 sketch draws into a *grayscale* anti-aliased buffer. The real
 * Move OLED is strictly 1-bit (schwung js_display.c: `buffer[..] = value ? 1 : 0`;
 * the emulator's display sink is `shade = v ? FG : BG`). Reducing anti-aliased
 * grayscale to 1-bit looks bad — thin AA strokes fragment into dashes under a
 * threshold, and dithering the soft glows fills shapes with stipple noise. So
 * we DON'T downsample grayscale: we keep all of the sketch's animation timing
 * (the eased signal-in / ring-in / lock / wordmark phases and waveform drift)
 * but render with crisp 1-bit-native primitives — solid Bresenham strokes, a
 * midpoint-circle ring, a cleared knob interior, and a left-to-right wordmark
 * wipe — which is the look these monochrome panels are made for.
 *
 * Animation timing: renderSplashScreen is called once per UI tick while the
 * boot splash is visible (the tick workflow forces S.screenDirty during the
 * splash so the OLED refreshes every tick). We advance one animation frame
 * every SPLASH_TICKS_PER_FRAME ticks so the ~94 Hz device tick rate plays the
 * sketch back near its native ~11 Hz. The per-splash frame counter
 * (S.splashFrameTick) resets on each splash entry edge.
 */

export const SPLASH_W = 128;
export const SPLASH_H = 64;

/* Device ticks per animation frame. JS tick rate is ~94 Hz (see CLAUDE.md), so
 * 6 ticks/frame ≈ 15.7 fps — a snappy reveal. */
export const SPLASH_TICKS_PER_FRAME = 6;

/* Animation structure (frames):
 *   INTRO   0 .. SPLASH_SETTLE_FRAME — signal sweeps in, knob locks, wordmark
 *                                      wipes in. Plays once, settles quickly.
 *   LOOP    >= SPLASH_SETTLE_FRAME    — the settled logo with a seamless
 *                                      breathing idle (period SPLASH_LOOP_FRAMES).
 *
 * The splash is NOT a fixed-length clip. The screen router shows it while
 * `stateLoading || bootSplashTicks > 0`, so it holds (looping) for exactly as
 * long as the app is still loading. S.bootSplashTicks (ui_state.mjs) is only a
 * MINIMUM floor — sized to guarantee the intro + a beat of settle always play
 * even when loading finishes instantly. When loading outlasts the floor, the
 * settle phase loops seamlessly until load completes, then the splash exits. */
export const SPLASH_SETTLE_FRAME = 28;
export const SPLASH_LOOP_FRAMES = 26;

const TWO_PI = Math.PI * 2;
const PI = Math.PI;

/* ---- p5-equivalent math helpers ----------------------------------------- */

function clampN(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function mapN(v, a, b, c, d) { return c + (v - a) * (d - c) / (b - a); }
function lerpN(a, b, t) { return a + (b - a) * t; }
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function impactPulse(frame, start, duration) {
    const u = clampN(mapN(frame, start, start + duration, 0, 1), 0, 1);
    if (u <= 0 || u >= 1) return 0;
    return Math.sin(u * PI) * (1 - u * 0.35);
}

function waveformDrift(frame) {
    const fast = 0.24;
    const slow = 0.12;
    const settleStart = 20;
    const settleEnd = 42;

    if (frame <= settleStart) return frame * fast;

    const settleFrames = settleEnd - settleStart;
    if (frame >= settleEnd) {
        return (
            settleStart * fast +
            settleFrames * ((fast + slow) * 0.5) +
            (frame - settleEnd) * slow
        );
    }
    const u = (frame - settleStart) / settleFrames;
    const easedAverage = fast + (slow - fast) * (u * u * u - 0.5 * u * u * u * u) / u;
    return settleStart * fast + (frame - settleStart) * easedAverage;
}

/* ---- 1-bit framebuffer + crisp rasterizer -------------------------------- */

/* Reused across frames: one byte per pixel, 0 = off, 1 = lit. */
const FB = new Uint8Array(SPLASH_W * SPLASH_H);

function clearBuf() { FB.fill(0); }

function plot(x, y, v) {
    x |= 0; y |= 0;
    if (x < 0 || x >= SPLASH_W || y < 0 || y >= SPLASH_H) return;
    FB[y * SPLASH_W + x] = v;
}

/* Solid integer line (Bresenham) — continuous, no anti-aliasing. */
function line(x0, y0, x1, y1, v) {
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
        plot(x0, y0, v);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
}

/* Connect a polyline of {x,y} points with solid segments. weight 2 draws a
 * second pass one pixel below for a bolder line. */
function polyline(pts, v, weight) {
    for (let i = 1; i < pts.length; i++) {
        line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y, v);
        if (weight >= 2) line(pts[i - 1].x, pts[i - 1].y + 1, pts[i].x, pts[i].y + 1, v);
    }
}

/* Midpoint circle outline (1px). */
function circle(cx, cy, r, v) {
    cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
    if (r <= 0) { plot(cx, cy, v); return; }
    let x = r;
    let y = 0;
    let err = 1 - r;
    while (x >= y) {
        plot(cx + x, cy + y, v); plot(cx + y, cy + x, v);
        plot(cx - y, cy + x, v); plot(cx - x, cy + y, v);
        plot(cx - x, cy - y, v); plot(cx - y, cy - x, v);
        plot(cx + y, cy - x, v); plot(cx + x, cy - y, v);
        y++;
        if (err < 0) { err += 2 * y + 1; }
        else { x--; err += 2 * (y - x) + 1; }
    }
}

/* Filled disc — used to clear (v=0) the knob interior. */
function disc(cx, cy, r, v) {
    const r2 = r * r;
    const minY = Math.ceil(cy - r);
    const maxY = Math.floor(cy + r);
    for (let y = minY; y <= maxY; y++) {
        const dy = y - cy;
        const span = Math.sqrt(Math.max(0, r2 - dy * dy));
        const minX = Math.ceil(cx - span);
        const maxX = Math.floor(cx + span);
        for (let x = minX; x <= maxX; x++) plot(x, y, v);
    }
}

/* ---- scene drawing -------------------------------------------------------- */

const CENTER_X = 64;
const CENTER_Y = 28;

function buildWavePoints(startX, endX, ringIn, lock, drift, amp, detail) {
    const wrapStart = CENTER_X - lerpN(10, 16, ringIn);
    const wrapEnd = CENTER_X + lerpN(10, 16, ringIn);
    const pts = [];
    for (let x = startX; x <= endX; x += 1) {
        const nx = x / SPLASH_W;
        const wrap = clampN(mapN(x, wrapStart, wrapEnd, 0, 1), 0, 1);
        const o = Math.sin(wrap * PI);
        const y =
            CENTER_Y + 1 +
            Math.sin(nx * TWO_PI * 2.35 + drift) * lerpN(5, amp, lock) +
            Math.sin(nx * TWO_PI * 7.1 + drift * 0.34) * detail +
            o * lerpN(0, -11, ringIn);
        pts.push({ x, y });
    }
    return pts;
}

/* amp is the target waveform amplitude (px); the wave grows from 5px to amp as
 * lock goes 0→1. */
function drawWaveform(signalIn, ringIn, lock, drift, amp) {
    const right = Math.floor(lerpN(-14, 122, signalIn));
    const startX = Math.max(6, right - 126);
    const endX = Math.min(122, right);
    if (endX < startX) return;
    const pts = buildWavePoints(startX, endX, ringIn, lock, drift, amp, 1);
    polyline(pts, 1, 2);
}

function drawEncoderKnob(ringIn, lockHit, turn) {
    if (ringIn <= 0) return;
    const outer = lerpN(5, 14, ringIn);
    /* Clear a disc so the waveform doesn't collide with the ring. */
    disc(CENTER_X, CENTER_Y, outer + 1, 0);
    /* Ring outline (a second inner ring once locked in, for weight). */
    circle(CENTER_X, CENTER_Y, outer, 1);
    if (ringIn > 0.85) circle(CENTER_X, CENTER_Y, outer - 1, 1);
    /* Pointer. */
    const a = lerpN(-2.35, 0.35, turn) + lockHit * 0.1;
    line(
        CENTER_X + Math.cos(a) * 2, CENTER_Y + Math.sin(a) * 2,
        CENTER_X + Math.cos(a) * (outer - 3), CENTER_Y + Math.sin(a) * (outer - 3),
        1,
    );
}

const WORDMARK_GLYPHS = {
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    V: ['10001', '10001', '10001', '01010', '01010', '00100', '00100'],
    E: ['1111', '1000', '1000', '1110', '1000', '1000', '1111'],
    R: ['1110', '1001', '1001', '1110', '1010', '1001', '1001'],
    T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    U: ['1001', '1001', '1001', '1001', '1001', '1001', '0110'],
};
const WORDMARK = 'OVERTURE';
const WORDMARK_SPACING = 1;

function wordmarkWidth() {
    let width = -1;
    for (let i = 0; i < WORDMARK.length; i++) {
        width += WORDMARK_GLYPHS[WORDMARK[i]][0].length + WORDMARK_SPACING;
    }
    return width;
}

/* Left-to-right wipe reveal — the 1-bit equivalent of the sketch's brightness
 * fade-in. `appear` (0..1) drives the reveal edge across the wordmark. */
function drawWordmark(appear) {
    if (appear <= 0) return;
    const width = wordmarkWidth();
    const x0 = Math.floor((SPLASH_W - width) / 2);
    const y = 56;
    const revealX = x0 + appear * (width + 2);

    let x = x0;
    for (let i = 0; i < WORDMARK.length; i++) {
        const glyph = WORDMARK_GLYPHS[WORDMARK[i]];
        for (let row = 0; row < glyph.length; row++) {
            for (let col = 0; col < glyph[row].length; col++) {
                if (glyph[row][col] === '1' && (x + col) <= revealX) plot(x + col, y + row, 1);
            }
        }
        x += glyph[0].length + WORDMARK_SPACING;
    }
}

const SETTLED_AMP = 7.5;   /* settled waveform amplitude (px) */
const BREATH_AMP = 1.4;    /* idle breathing depth (px) */

/* Per-frame animation parameters, split into the one-shot INTRO and the
 * seamless settled LOOP. At the intro→loop boundary every value matches (lock,
 * ringIn, wordIn, signalIn all reach 1; breath starts at 0 = settled amp), and
 * the loop is periodic in SPLASH_LOOP_FRAMES, so it holds and repeats with no
 * visible seam for as long as the app keeps loading. */
function frameParams(bootFrame) {
    if (bootFrame < SPLASH_SETTLE_FRAME) {
        return {
            signalIn: easeOutCubic(clampN(mapN(bootFrame, 1, 9, 0, 1), 0, 1)),
            ringIn: easeOutCubic(clampN(mapN(bootFrame, 5, 15, 0, 1), 0, 1)),
            lock: easeOutCubic(clampN(mapN(bootFrame, 13, 23, 0, 1), 0, 1)),
            wordIn: easeOutCubic(clampN(mapN(bootFrame, 17, 27, 0, 1), 0, 1)),
            lockHit: impactPulse(bootFrame, 18, 7),
            turn: easeInOutCubic(clampN(mapN(bootFrame, 6, 20, 0, 1), 0, 1)),
            drift: waveformDrift(bootFrame),
            amp: SETTLED_AMP,
        };
    }
    /* LOOP: settled, with a seamless amplitude breath. Drift is frozen at its
     * settle value so the waveform comes to rest instead of scrolling forever. */
    const loopT = ((bootFrame - SPLASH_SETTLE_FRAME) % SPLASH_LOOP_FRAMES) / SPLASH_LOOP_FRAMES;
    return {
        signalIn: 1, ringIn: 1, lock: 1, wordIn: 1, lockHit: 0, turn: 1,
        drift: waveformDrift(SPLASH_SETTLE_FRAME),
        amp: SETTLED_AMP + Math.sin(loopT * TWO_PI) * BREATH_AMP,
    };
}

/* Render animation frame `bootFrame` into FB. */
function rasterizeFrame(bootFrame) {
    clearBuf();
    const p = frameParams(bootFrame);
    drawWaveform(p.signalIn, p.ringIn, p.lock, p.drift, p.amp);
    drawEncoderKnob(p.ringIn, p.lockHit, p.turn);
    drawWordmark(p.wordIn);
}

/* ---- run emission --------------------------------------------------------- */

/* Emit coalesced horizontal lit-runs via deps.fillRect. */
function emitFrame(deps) {
    for (let y = 0; y < SPLASH_H; y++) {
        const row = y * SPLASH_W;
        let runStart = -1;
        for (let x = 0; x < SPLASH_W; x++) {
            if (FB[row + x]) {
                if (runStart < 0) runStart = x;
            } else if (runStart >= 0) {
                deps.fillRect(runStart, y, x - runStart, 1, 1);
                runStart = -1;
            }
        }
        if (runStart >= 0) deps.fillRect(runStart, y, SPLASH_W - runStart, 1, 1);
    }
}

/* Render a single animation frame (rasterize + emit). Does NOT clear the
 * screen — callers own that. Exposed for tests. */
export function renderSplashAnimationFrame(deps, bootFrame) {
    rasterizeFrame(bootFrame | 0);
    emitFrame(deps);
}

/* Splash entry point, called once per tick while the boot splash is visible.
 * Advances the animation off S.splashFrameTick, which resets on the entry edge
 * (splashWasVisible false → true). */
export function renderSplashScreen(state, deps) {
    if (!state.splashWasVisible) {
        state.splashFrameTick = 0;
        state.splashWasVisible = true;
    } else {
        state.splashFrameTick = (state.splashFrameTick | 0) + 1;
    }
    const bootFrame = Math.floor((state.splashFrameTick | 0) / SPLASH_TICKS_PER_FRAME);

    deps.clear();
    renderSplashAnimationFrame(deps, bootFrame);
}
