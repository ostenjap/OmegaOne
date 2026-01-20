
export interface FluidConfig {
  width: number;
  height: number;
  viscosity: number;
  inflowVelocity: number;
}

export interface SimulationState {
  ux: Float32Array;
  uy: Float32Array;
  vorticity: Float32Array;
  obstacles: Uint8Array;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  source: 'SYS' | 'USER' | 'AI';
  content: string;
}

export interface TacticalShape {
  type: 'wing' | 'circle' | 'rectangle' | 'custom';
  params: {
    x: number;
    y: number;
    width?: number;
    height?: number;
    radius?: number;
  };
}
