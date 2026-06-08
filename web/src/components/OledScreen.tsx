// The OLED. The internal buffer stays 128×64 (the host display sink draws device
// pixels); CSS scales the box up and keeps it crisp with image-rendering: pixelated.
// Monochrome white-on-black like the real Move, with a faint cool glow. main's
// display sink grabs ctx via this ref.
import type { Ref } from "react";

export function OledScreen({ canvasRef }: { canvasRef: Ref<HTMLCanvasElement> }) {
  return (
    <canvas
      id="oled"
      ref={canvasRef}
      width={128}
      height={64}
      className="aspect-[2/1] w-full shrink-0 rounded-md border border-zinc-700 bg-black shadow-[0_0_34px_-16px_rgba(190,205,255,0.55)]"
    />
  );
}
