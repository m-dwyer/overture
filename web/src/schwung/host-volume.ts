import { DEFAULT_BROWSER_MASTER_GAIN } from "./audio-engine.js";
import { HOST_VOLUME, MIDI_DATA_MASK, RELATIVE_ENCODER } from "../lib/move-controls.js";

export interface HostVolumeControllerOptions {
  log(message: string): void;
  onChange(): void;
  setMasterGain(volume: number): void;
}

export class HostVolumeController {
  #log: (message: string) => void;
  #onChange: () => void;
  #setMasterGain: (volume: number) => void;
  #volume: number = HOST_VOLUME.Default;

  constructor(options: HostVolumeControllerOptions) {
    this.#log = options.log;
    this.#onChange = options.onChange;
    this.#setMasterGain = options.setMasterGain;
  }

  get(): number {
    return this.#volume;
  }

  set(volume: number): void {
    const next = clampHostVolume(volume);
    if (next === this.#volume) {
      this.#log(`host volume: ${next}`);
      return;
    }
    this.#volume = next;
    this.#setMasterGain(hostVolumeToBrowserGain(next));
    this.#log(`host volume: ${next}`);
    this.#onChange();
  }

  handleRelativeCc(value: number): boolean {
    const delta = relativeVolumeDelta(value);
    if (delta !== 0) this.set(this.#volume + delta);
    return true;
  }

  browserGain(): number {
    return hostVolumeToBrowserGain(this.#volume);
  }
}

function clampHostVolume(volume: number): number {
  const numeric = Number.isFinite(volume) ? Math.round(volume) : HOST_VOLUME.Default;
  return Math.max(HOST_VOLUME.Min, Math.min(HOST_VOLUME.Max, numeric));
}

function hostVolumeToBrowserGain(volume: number): number {
  return (clampHostVolume(volume) / HOST_VOLUME.Max) * DEFAULT_BROWSER_MASTER_GAIN;
}

function relativeVolumeDelta(value: number): number {
  const midiValue = value & MIDI_DATA_MASK;
  if (midiValue >= RELATIVE_ENCODER.ClockwiseMin && midiValue <= RELATIVE_ENCODER.ClockwiseMax) {
    if (midiValue > RELATIVE_ENCODER.AccelerationFastThreshold) return RELATIVE_ENCODER.FastStep;
    if (midiValue > RELATIVE_ENCODER.AccelerationMediumThreshold) return RELATIVE_ENCODER.MediumStep;
    return RELATIVE_ENCODER.SlowStep;
  }
  if (midiValue >= RELATIVE_ENCODER.CounterClockwiseMin && midiValue <= RELATIVE_ENCODER.CounterClockwiseMax) {
    const speed = RELATIVE_ENCODER.CounterClockwiseMax + RELATIVE_ENCODER.SlowStep - midiValue;
    if (speed > RELATIVE_ENCODER.AccelerationFastThreshold) return -RELATIVE_ENCODER.FastStep;
    if (speed > RELATIVE_ENCODER.AccelerationMediumThreshold) return -RELATIVE_ENCODER.MediumStep;
    return -RELATIVE_ENCODER.SlowStep;
  }
  return 0;
}
