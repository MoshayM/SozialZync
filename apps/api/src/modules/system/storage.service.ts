import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, statSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import * as os from 'os';

const execFileAsync = promisify(execFile);

export interface StorageCategoryStats {
  category: string;
  label: string;
  path: string;
  sizeBytes: number;
  fileCount: number;
  exists: boolean;
}

export interface StorageStats {
  basePath: string;
  totalUsedBytes: number;
  categories: StorageCategoryStats[];
  diskTotal: number;
  diskFree: number;
  diskUsed: number;
}

// Default base storage path — resolves to $HOME/.sozialzync or custom via env
function getBasePath(): string {
  return process.env['STORAGE_BASE_PATH'] ?? join(os.homedir(), '.sozialzync');
}

function dirSizeBytes(dirPath: string): { size: number; count: number } {
  if (!existsSync(dirPath)) return { size: 0, count: 0 };
  let size = 0;
  let count = 0;
  try {
    const stack = [dirPath];
    while (stack.length) {
      const current = stack.pop()!;
      const stat = statSync(current);
      if (stat.isDirectory()) {
        for (const entry of readdirSync(current)) {
          stack.push(join(current, entry));
        }
      } else {
        size += stat.size;
        count++;
      }
    }
  } catch { /* permission errors — skip */ }
  return { size, count };
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  readonly CATEGORIES = [
    { category: 'images',   label: 'Generated Images', subdir: 'images'   },
    { category: 'videos',   label: 'Generated Videos', subdir: 'videos'   },
    { category: 'voices',   label: 'Voice Audio',       subdir: 'voices'   },
    { category: 'music',    label: 'Music Library',     subdir: 'music'    },
    { category: 'models',   label: 'AI Models',         subdir: 'models'   },
    { category: 'cache',    label: 'Cache',             subdir: 'cache'    },
    { category: 'projects', label: 'Projects',          subdir: 'projects' },
    { category: 'assets',   label: 'Assets',            subdir: 'assets'   },
  ];

  getBasePath(): string {
    return getBasePath();
  }

  getCategoryPath(category: string): string {
    const cat = this.CATEGORIES.find(c => c.category === category);
    return join(getBasePath(), cat?.subdir ?? category);
  }

  async getStats(): Promise<StorageStats> {
    const basePath = getBasePath();
    const categories: StorageCategoryStats[] = this.CATEGORIES.map(cat => {
      const catPath = join(basePath, cat.subdir);
      const { size, count } = dirSizeBytes(catPath);
      return {
        category: cat.category,
        label: cat.label,
        path: catPath,
        sizeBytes: size,
        fileCount: count,
        exists: existsSync(catPath),
      };
    });

    const totalUsedBytes = categories.reduce((s, c) => s + c.sizeBytes, 0);

    // Disk stats for the base path drive
    let diskTotal = 0, diskFree = 0, diskUsed = 0;
    try {
      if (process.platform === 'win32') {
        const driveLetter = basePath.match(/^([A-Za-z]:)/)?.[1] ?? 'C:';
        const { stdout } = await execFileAsync('wmic', ['logicaldisk', 'where', `DeviceID='${driveLetter}'`, 'get', 'Size,FreeSpace', '/value'], { timeout: 5000 });
        const free = parseInt(stdout.match(/FreeSpace=(\d+)/)?.[1] ?? '0');
        const total = parseInt(stdout.match(/Size=(\d+)/)?.[1] ?? '0');
        diskTotal = total; diskFree = free; diskUsed = total - free;
      } else {
        const { stdout } = await execFileAsync('df', ['-k', existsSync(basePath) ? basePath : os.homedir()], { timeout: 5000 });
        const parts = stdout.split('\n')[1]?.trim().split(/\s+/) ?? [];
        diskTotal = parseInt(parts[1] ?? '0') * 1024;
        diskUsed  = parseInt(parts[2] ?? '0') * 1024;
        diskFree  = parseInt(parts[3] ?? '0') * 1024;
      }
    } catch { /* non-fatal */ }

    return { basePath, totalUsedBytes, categories, diskTotal, diskFree, diskUsed };
  }

  async clearCategory(category: string): Promise<{ ok: boolean; freedBytes: number }> {
    const catPath = this.getCategoryPath(category);
    if (!existsSync(catPath)) return { ok: true, freedBytes: 0 };
    const { size } = dirSizeBytes(catPath);
    try {
      rmSync(catPath, { recursive: true, force: true });
      this.logger.log(`Cleared storage category '${category}' (${size} bytes freed)`);
      return { ok: true, freedBytes: size };
    } catch (e) {
      this.logger.error(`Failed to clear '${category}': ${String(e)}`);
      return { ok: false, freedBytes: 0 };
    }
  }
}
