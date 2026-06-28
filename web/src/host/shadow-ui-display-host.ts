import type { HostApi } from "../host-api.js";
import type { DisplaySink } from "./sinks.js";

type DisplayHostApi = Pick<
  HostApi,
  "clear_screen" | "fill_rect" | "draw_rect" | "set_pixel" | "print" | "text_width" | "host_flush_display"
>;

export function createDisplayHostApi(display: DisplaySink): DisplayHostApi {
  return {
    clear_screen(): void {
      display.clearScreen();
    },
    fill_rect(x: number, y: number, w: number, h: number, value: number | boolean): void {
      display.fillRect(x, y, w, h, value);
    },
    draw_rect(x: number, y: number, w: number, h: number, value: number | boolean): void {
      display.drawRect(x, y, w, h, value);
    },
    set_pixel(x: number, y: number, value: number | boolean): void {
      display.setPixel(x, y, value);
    },
    print(x: number, y: number, text: unknown, color = 1): void {
      display.print(x, y, String(text ?? ""), color);
    },
    text_width(text: unknown): number {
      return display.textWidth(String(text ?? ""));
    },
    host_flush_display(): void {
      display.flush();
    },
  };
}
