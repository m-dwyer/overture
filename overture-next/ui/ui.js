import { createSchwungAdapter } from '../src/host/schwung-adapter.ts';
import { installSchwungRuntime } from '../src/host/schwung-runtime.ts';
import { createOvertureRuntime } from '../src/runtime/overture-runtime.ts';

const adapter = createSchwungAdapter();
const runtime = createOvertureRuntime(adapter);

installSchwungRuntime({
  init() {
    runtime.init();
  },
  tick() {
    runtime.tick();
  },
  onMidiMessageInternal(data) {
    runtime.onMidiMessage(data);
  },
  onMidiMessageExternal(data) {
    runtime.onMidiMessage(data);
  },
  onUnload() {
    runtime.onUnload();
  },
}, {
  overtureNext: runtime.core,
  overtureRuntime: runtime,
});
