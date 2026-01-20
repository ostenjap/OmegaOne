
import { FluidConfig, SimulationState } from '../types';

export class FluidEngine {
  public nx: number;
  public ny: number;
  private f: Float32Array;
  private feq: Float32Array;
  private rho: Float32Array;
  private ux: Float32Array;
  private uy: Float32Array;
  private obstacles: Uint8Array;
  private viscosity: number;
  private omega: number;
  private inflowVelocity: number;

  private weights = new Float32Array([4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36]);
  private vx = new Int32Array([0, 1, 0, -1, 0, 1, -1, -1, 1]);
  private vy = new Int32Array([0, 0, 1, 0, -1, 1, 1, -1, -1]);

  private tracers: Float32Array;
  private numTracers = 600;

  constructor(config: FluidConfig) {
    this.nx = config.width;
    this.ny = config.height;
    this.viscosity = config.viscosity;
    this.inflowVelocity = config.inflowVelocity;
    this.omega = 1 / (3 * this.viscosity + 0.5);

    const size = this.nx * this.ny;
    this.f = new Float32Array(9 * size);
    this.feq = new Float32Array(9 * size);
    this.rho = new Float32Array(size);
    this.ux = new Float32Array(size);
    this.uy = new Float32Array(size);
    this.obstacles = new Uint8Array(size);

    this.tracers = new Float32Array(this.numTracers * 2);
    this.initTracers();
    this.reset(this.inflowVelocity);
  }

  private initTracers() {
    for (let i = 0; i < this.numTracers; i++) {
      this.tracers[i * 2] = Math.random() * this.nx;
      this.tracers[i * 2 + 1] = Math.random() * this.ny;
    }
  }

  public reset(inflowVel: number) {
    this.inflowVelocity = inflowVel;
    const size = this.nx * this.ny;
    for (let i = 0; i < size; i++) {
      this.rho[i] = 1.0;
      this.ux[i] = inflowVel;
      this.uy[i] = 0;
      for (let k = 0; k < 9; k++) {
        const cu = 3 * (this.vx[k] * this.ux[i] + this.vy[k] * this.uy[i]);
        this.f[k * size + i] = this.weights[k] * (1 + cu + 0.5 * cu * cu - 1.5 * (this.ux[i] * this.ux[i] + this.uy[i] * this.uy[i]));
      }
    }
    this.initTracers();
  }

  public setViscosity(v: number) {
    this.viscosity = Math.max(0.001, v);
    this.omega = 1 / (3 * this.viscosity + 0.5);
  }

  public setInflow(v: number) {
    this.inflowVelocity = v;
  }

  public addObstacle(x: number, y: number, radius: number, isErase: boolean = false) {
    const rSq = radius * radius;
    for (let j = Math.max(0, Math.floor(y - radius)); j < Math.min(this.ny, Math.ceil(y + radius)); j++) {
      for (let i = Math.max(0, Math.floor(x - radius)); i < Math.min(this.nx, Math.ceil(x + radius)); i++) {
        if ((i - x) ** 2 + (j - y) ** 2 < rSq) {
          this.obstacles[j * this.nx + i] = isErase ? 0 : 1;
        }
      }
    }
  }

  public clearObstacles() {
    this.obstacles.fill(0);
  }

  public step() {
    const size = this.nx * this.ny;
    for (let y = 0; y < this.ny; y++) {
      const i = y * this.nx;
      this.ux[i] = this.inflowVelocity;
      this.uy[i] = 0;
      this.rho[i] = 1.0;
    }

    const fNew = new Float32Array(this.f.length);
    for (let k = 0; k < 9; k++) {
      for (let y = 0; y < this.ny; y++) {
        for (let x = 0; x < this.nx; x++) {
          let nextX = x + this.vx[k], nextY = y + this.vy[k];
          if (nextX < 0) nextX = this.nx - 1; if (nextX >= this.nx) nextX = 0;
          if (nextY < 0) nextY = this.ny - 1; if (nextY >= this.ny) nextY = 0;
          fNew[k * size + nextY * this.nx + nextX] = this.f[k * size + y * this.nx + x];
        }
      }
    }
    this.f = fNew;

    for (let i = 0; i < size; i++) {
      if (this.obstacles[i]) continue;
      let r = 0, vx = 0, vy = 0;
      for (let k = 0; k < 9; k++) {
        const val = this.f[k * size + i];
        r += val; vx += val * this.vx[k]; vy += val * this.vy[k];
      }
      this.rho[i] = r; this.ux[i] = vx / r; this.uy[i] = vy / r;
    }

    for (let k = 0; k < 9; k++) {
      for (let i = 0; i < size; i++) {
        if (this.obstacles[i]) {
          const oppK = [0, 3, 4, 1, 2, 7, 8, 5, 6][k];
          this.f[k * size + i] = this.f[oppK * size + i];
          continue;
        }
        const cu = 3 * (this.vx[k] * this.ux[i] + this.vy[k] * this.uy[i]);
        const feq = this.weights[k] * this.rho[i] * (1 + cu + 0.5 * cu * cu - 1.5 * (this.ux[i] * this.ux[i] + this.uy[i] * this.uy[i]));
        this.f[k * size + i] += this.omega * (feq - this.f[k * size + i]);
      }
    }

    for (let i = 0; i < this.numTracers; i++) {
      const tx = this.tracers[i * 2], ty = this.tracers[i * 2 + 1];
      const ix = Math.floor(tx) % this.nx, iy = Math.floor(ty) % this.ny;
      const idx = iy * this.nx + ix;
      this.tracers[i * 2] += this.ux[idx] * 5; this.tracers[i * 2 + 1] += this.uy[idx] * 5;
      if (this.tracers[i * 2] >= this.nx) this.tracers[i * 2] = 0;
      if (this.tracers[i * 2] < 0) this.tracers[i * 2] = this.nx - 1;
      if (this.tracers[i * 2 + 1] >= this.ny) this.tracers[i * 2 + 1] = 0;
      if (this.tracers[i * 2 + 1] < 0) this.tracers[i * 2 + 1] = this.ny - 1;
    }
  }

  public getVorticity(): Float32Array {
    const vort = new Float32Array(this.nx * this.ny);
    for (let y = 1; y < this.ny - 1; y++) {
      for (let x = 1; x < this.nx - 1; x++) {
        const i = y * this.nx + x;
        vort[i] = (this.uy[i + 1] - this.uy[i - 1]) * 0.5 - (this.ux[i + this.nx] - this.ux[i - this.nx]) * 0.5;
      }
    }
    return vort;
  }

  public getSpeed(): Float32Array {
    const speed = new Float32Array(this.nx * this.ny);
    for (let i = 0; i < this.nx * this.ny; i++) speed[i] = Math.sqrt(this.ux[i]**2 + this.uy[i]**2);
    return speed;
  }

  public getObstacles(): Uint8Array { return this.obstacles; }
  public getTracers(): Float32Array { return this.tracers; }
}
