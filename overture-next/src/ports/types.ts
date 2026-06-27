import type { HostCommand } from "../core/host-commands";
import type { CoreSnapshot } from "../core/types";

export interface SplashSurface {
  clear(): void;
  fillRect(x: number, y: number, width: number, height: number, color: number): void;
}

export interface RuntimePort {
  publishState(snapshot: CoreSnapshot): void;
}

export interface DisplayPort {
  splashSurface: SplashSurface;
  clear(): void;
  print(x: number, y: number, text: string, color: number): void;
  rect(x: number, y: number, width: number, height: number, color: number, fill: boolean): void;
  flush(): void;
}

export interface LedPort {
  setStepLed(step: number, color: number): void;
  setPadLed(padIndex: number, color: number): void;
  setTrackRowLed(row: number, color: number): void;
  setPlayLed(color: number): void;
  setMenuLed(color: number): void;
}

export interface HostCommandPort {
  execute(command: HostCommand): void;
}
