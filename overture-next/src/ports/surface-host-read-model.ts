export interface SchwungParameterReadModel {
  id: string;
  name: string;
}

export interface SchwungModuleReadModel {
  id: string;
  name: string;
  parameters: readonly SchwungParameterReadModel[];
}

export interface SchwungChainReadModel {
  chainIndex: number;
  name: string;
  synthModule: SchwungModuleReadModel | null;
}

export interface SchwungChainReadPort {
  readChain(chainIndex: number): SchwungChainReadModel | null;
}

export interface SurfaceHostReadModel {
  selectedSchwungChain?: SchwungChainReadModel | null;
}
