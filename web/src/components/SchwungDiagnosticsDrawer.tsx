import { HOST_VOLUME } from "@/lib/move-controls";
import type { BrowserHarnessDiagnostics } from "@/host/browser-emulator-harness";

export function SchwungDiagnosticsDrawer({
  diagnostics,
  onReset,
}: {
  diagnostics: BrowserHarnessDiagnostics | null;
  onReset(): void;
}) {
  const diag = diagnostics ?? {
    errors: [],
    hostVolume: HOST_VOLUME.Default,
    midi: [],
    params: [],
    slots: [],
    worklet: {},
  };
  return (
    <aside className="w-[min(92vw,440px)] rounded border border-line bg-black/70 p-3 text-left text-[11px] text-muted">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-[0.16em] text-accent">
          SCHWUNG AUDIO
        </h2>
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-line px-2 py-0.5 text-[11px] text-text hover:border-accent"
        >
          Reset
        </button>
      </div>
      <DiagBlock
        title="Chain"
        rows={diag.slots.map(
          (slot) =>
            `${slot.name} ch${slot.channel}: ${slot.midiFx || "--"} > ${slot.synth || "--"} > ${slot.fx1 || "--"} > ${slot.fx2 || "--"}`,
        )}
      />
      <DiagBlock
        title="Worklet"
        rows={Object.entries(diag.worklet).map(
          ([slot, state]) => `${slot}: ${state}`,
        )}
      />
      <DiagBlock title="Host" rows={[`volume=${diag.hostVolume}`]} />
      <DiagBlock
        title="Params"
        rows={diag.params.map(
          (item) => `S${item.slot + 1} ${item.key}=${item.value}`,
        )}
      />
      <DiagBlock
        title="MIDI"
        rows={diag.midi.map(
          (item) =>
            `S${item.slot + 1} ${item.direction} ${item.status.toString(16)} ${item.d1} ${item.d2}`,
        )}
      />
      <DiagBlock
        title="Errors"
        rows={diag.errors.map((item) => `${item.slotId}: ${item.message}`)}
      />
    </aside>
  );
}

function DiagBlock({ title, rows }: { title: string; rows: string[] }) {
  return (
    <section className="mt-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text">
        {title}
      </h3>
      <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-black/50 p-2 leading-snug">
        {rows.length ? rows.join("\n") : "--"}
      </pre>
    </section>
  );
}
