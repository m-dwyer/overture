// Ambient type for the emscripten ES-module factory the tool builds
// (overture-ui/dist/wasm/seq8.mjs, via overture-ui/scripts/build-wasm.sh). It's a JS build
// artifact, so we type only the runtime surface the adapter uses.
declare module "seq8-wasm" {
  export interface Seq8WasmModule {
    ccall(name: string, returnType: string | null, argTypes: string[], args: unknown[]): number;
    _malloc(bytes: number): number;
    _free(ptr: number): void;
    UTF8ToString(ptr: number, maxBytesToRead?: number): string;
  }
  const factory: (opts?: Record<string, unknown>) => Promise<Seq8WasmModule>;
  export default factory;
}
