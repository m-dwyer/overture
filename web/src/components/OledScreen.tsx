// The OLED. The device screen is 128×64; the host display sink draws device pixels.
// The internal buffer is supersampled by `scale` so graphics render as crisp scale×
// blocks (pixel-faithful) while print() text draws anti-aliased and legible. The CSS
// box size is unchanged (w-full / aspect-[2/1]) — only the backing-store density
// changes. In exact mode (scale=1, smooth=false) image-rendering: pixelated keeps the
// nearest-neighbor upscale crisp, reproducing the literal device pixels. main's
// display sink grabs ctx via this ref. Monochrome white-on-black, faint cool glow.
import type { Ref } from "react";

export function OledScreen({
  canvasRef,
  scale,
  smooth,
}: {
  canvasRef: Ref<HTMLCanvasElement>;
  scale: number;
  smooth: boolean;
}) {
  return (
    <canvas
      id="oled"
      ref={canvasRef}
      width={128 * scale}
      height={64 * scale}
      style={{ imageRendering: smooth ? "auto" : "pixelated" }}
      className="aspect-[2/1] w-full shrink-0 rounded-md border border-zinc-700 bg-black shadow-[0_0_34px_-16px_rgba(190,205,255,0.55)]"
    />
  );
}
