import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execFileAsync = promisify(execFile);

export type GpuBackend = 'cuda' | 'rocm' | 'metal' | 'intel' | 'cpu';

export interface GpuInfo {
  backend: GpuBackend;
  name: string;
  vramMb?: number;
  driverVersion?: string;
  cudaVersion?: string;
  utilizationPct?: number;
  memUsedMb?: number;
  memTotalMb?: number;
  temperature?: number;
}

export interface SystemStats {
  gpus: GpuInfo[];
  primaryBackend: GpuBackend;
  cpuModel: string;
  cpuCores: number;
  totalRamMb: number;
  freeRamMb: number;
  platform: string;
  arch: string;
  nodeVersion: string;
}

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);
  private _cachedStats: SystemStats | null = null;
  private _cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 15_000; // 15s

  async getStats(forceRefresh = false): Promise<SystemStats> {
    if (!forceRefresh && this._cachedStats && Date.now() < this._cacheExpiresAt) {
      return this._cachedStats;
    }
    const [gpus, cpuModel] = await Promise.all([
      this.detectGpus(),
      this.getCpuModel(),
    ]);
    const primaryBackend = this.pickPrimaryBackend(gpus);
    const stats: SystemStats = {
      gpus,
      primaryBackend,
      cpuModel,
      cpuCores: os.cpus().length,
      totalRamMb: Math.round(os.totalmem() / 1024 / 1024),
      freeRamMb: Math.round(os.freemem() / 1024 / 1024),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
    };
    this._cachedStats = stats;
    this._cacheExpiresAt = Date.now() + this.CACHE_TTL_MS;
    return stats;
  }

  private pickPrimaryBackend(gpus: GpuInfo[]): GpuBackend {
    const priority: GpuBackend[] = ['cuda', 'rocm', 'metal', 'intel', 'cpu'];
    for (const b of priority) {
      if (gpus.some(g => g.backend === b)) return b;
    }
    return 'cpu';
  }

  private async detectGpus(): Promise<GpuInfo[]> {
    const results = await Promise.allSettled([
      this.detectNvidiaCuda(),
      this.detectAmdRocm(),
      this.detectAppleMetal(),
      this.detectIntelGpu(),
    ]);
    const gpus: GpuInfo[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') gpus.push(...r.value);
    }
    if (!gpus.length) gpus.push({ backend: 'cpu', name: 'CPU (no GPU detected)' });
    return gpus;
  }

  private async detectNvidiaCuda(): Promise<GpuInfo[]> {
    try {
      const { stdout } = await execFileAsync('nvidia-smi', [
        '--query-gpu=name,memory.total,memory.used,utilization.gpu,driver_version,temperature.gpu',
        '--format=csv,noheader,nounits',
      ], { timeout: 8000 });

      return stdout.trim().split('\n').filter(Boolean).map(line => {
        const parts = line.split(',').map(s => s.trim());
        return {
          backend: 'cuda' as GpuBackend,
          name: parts[0] ?? 'NVIDIA GPU',
          memTotalMb: parseInt(parts[1] ?? '0') || undefined,
          memUsedMb: parseInt(parts[2] ?? '0') || undefined,
          utilizationPct: parseInt(parts[3] ?? '0') || undefined,
          driverVersion: parts[4] ?? undefined,
          temperature: parseInt(parts[5] ?? '0') || undefined,
        };
      });
    } catch {
      return [];
    }
  }

  private async detectAmdRocm(): Promise<GpuInfo[]> {
    try {
      const { stdout } = await execFileAsync('rocm-smi', ['--showproductname', '--showmeminfo', 'vram', '--csv'], { timeout: 8000 });
      if (!stdout.includes('GPU')) return [];
      // Parse minimal info
      const lines = stdout.trim().split('\n').slice(1).filter(Boolean);
      return lines.map(line => {
        const parts = line.split(',').map(s => s.trim());
        return {
          backend: 'rocm' as GpuBackend,
          name: parts[0]?.replace(/^GPU\[\d+\]:\s*/, '') ?? 'AMD GPU',
        };
      });
    } catch {
      return [];
    }
  }

  private async detectAppleMetal(): Promise<GpuInfo[]> {
    if (os.platform() !== 'darwin') return [];
    try {
      const { stdout } = await execFileAsync('system_profiler', ['SPDisplaysDataType', '-json'], { timeout: 8000 });
      const data = JSON.parse(stdout) as { SPDisplaysDataType?: Array<{ sppci_model?: string; _spdisplays_vram?: string }> };
      const displays = data.SPDisplaysDataType ?? [];
      const gpuDisplays = displays.filter(d => d.sppci_model?.toLowerCase().includes('apple'));
      if (!gpuDisplays.length) return [];
      return gpuDisplays.map(d => ({
        backend: 'metal' as GpuBackend,
        name: d.sppci_model ?? 'Apple Silicon GPU',
        vramMb: d._spdisplays_vram ? parseInt(d._spdisplays_vram) * 1024 : undefined,
      }));
    } catch {
      return [];
    }
  }

  private async detectIntelGpu(): Promise<GpuInfo[]> {
    if (os.platform() !== 'linux') return [];
    try {
      const { stdout } = await execFileAsync('lspci', [], { timeout: 5000 });
      const intelGpuLine = stdout.split('\n').find(l =>
        l.toLowerCase().includes('intel') && l.toLowerCase().includes('vga')
      );
      if (!intelGpuLine) return [];
      return [{ backend: 'intel' as GpuBackend, name: intelGpuLine.trim() }];
    } catch {
      return [];
    }
  }

  private async getCpuModel(): Promise<string> {
    const cpus = os.cpus();
    return cpus[0]?.model ?? 'Unknown CPU';
  }

  async getDiskUsage(path: string): Promise<{ totalGb: number; usedGb: number; freeGb: number }> {
    const platform = os.platform();
    try {
      if (platform === 'win32') {
        const driveLetter = path.match(/^([A-Za-z]:)/)?.[1] ?? 'C:';
        const { stdout } = await execFileAsync('wmic', ['logicaldisk', 'where', `DeviceID='${driveLetter}'`, 'get', 'Size,FreeSpace', '/value'], { timeout: 5000 });
        const free = parseInt(stdout.match(/FreeSpace=(\d+)/)?.[1] ?? '0');
        const total = parseInt(stdout.match(/Size=(\d+)/)?.[1] ?? '0');
        return {
          totalGb: parseFloat((total / 1e9).toFixed(2)),
          usedGb: parseFloat(((total - free) / 1e9).toFixed(2)),
          freeGb: parseFloat((free / 1e9).toFixed(2)),
        };
      } else {
        const { stdout } = await execFileAsync('df', ['-k', path], { timeout: 5000 });
        const line = stdout.split('\n')[1] ?? '';
        const parts = line.trim().split(/\s+/);
        const total = parseInt(parts[1] ?? '0') * 1024;
        const used = parseInt(parts[2] ?? '0') * 1024;
        const free = parseInt(parts[3] ?? '0') * 1024;
        return {
          totalGb: parseFloat((total / 1e9).toFixed(2)),
          usedGb: parseFloat((used / 1e9).toFixed(2)),
          freeGb: parseFloat((free / 1e9).toFixed(2)),
        };
      }
    } catch {
      this.logger.warn(`getDiskUsage failed for path: ${path}`);
      return { totalGb: 0, usedGb: 0, freeGb: 0 };
    }
  }
}
