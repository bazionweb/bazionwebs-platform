import { spawn } from "node:child_process";

export interface ResticSnapshot {
  id: string;
  shortId: string;
  time: string;
  tags: string[];
}

interface ResticSnapshotRecord {
  id?: unknown;
  short_id?: unknown;
  time?: unknown;
  tags?: unknown;
}

export interface ResticTenantBackupProvider {
  createSnapshot(input: {
    sourceDirectory: string;
    tenantId: string;
    backupId: string;
    schemaVersion: string;
  }): Promise<{ snapshotId: string }>;
  listSnapshots(tenantId: string): Promise<ResticSnapshot[]>;
  restoreSnapshot(input: {
    tenantId: string;
    snapshotId: string;
    targetDirectory: string;
  }): Promise<void>;
}

export interface ResticProviderConfig {
  repository: string;
  passwordFile: string;
  binary?: string;
}

export function tenantBackupTags(tenantId: string): { tenant: string; prefix: string } {
  return { tenant: `bazion-tenant:${tenantId}`, prefix: "bazion-backup:" };
}

export function parseResticSnapshots(stdout: string, tenantId: string): ResticSnapshot[] {
  let parsed: unknown;
  try { parsed = JSON.parse(stdout); } catch { throw new Error("TENANT_BACKUP_RESTIC_OUTPUT_INVALID"); }
  if (!Array.isArray(parsed)) throw new Error("TENANT_BACKUP_RESTIC_OUTPUT_INVALID");
  const tenantTag = tenantBackupTags(tenantId).tenant;
  const snapshots: ResticSnapshot[] = [];
  for (const value of parsed as ResticSnapshotRecord[]) {
    if (!value || typeof value !== "object" ||
        typeof value.id !== "string" || !/^[a-f0-9]{8,64}$/i.test(value.id) ||
        typeof value.time !== "string" || !Number.isFinite(Date.parse(value.time)) ||
        !Array.isArray(value.tags) || !value.tags.every((tag) => typeof tag === "string")) continue;
    const tags = value.tags as string[];
    if (!tags.includes(tenantTag) || !tags.some((tag) => tag.startsWith("bazion-backup:"))) continue;
    snapshots.push({
      id: value.id,
      shortId: typeof value.short_id === "string" ? value.short_id : value.id.slice(0, 8),
      time: new Date(value.time).toISOString(),
      tags,
    });
  }
  return snapshots.sort((left, right) => right.time.localeCompare(left.time));
}

export function parseResticBackupSnapshotId(stdout: string): string {
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    let value: unknown;
    try { value = JSON.parse(lines[index]!); } catch { continue; }
    if (value && typeof value === "object" &&
        "snapshot_id" in value && typeof value.snapshot_id === "string" &&
        /^[a-f0-9]{8,64}$/i.test(value.snapshot_id)) return value.snapshot_id;
  }
  throw new Error("TENANT_BACKUP_RESTIC_SNAPSHOT_ID_MISSING");
}

/** Restic is responsible for repository-level encryption, deduplication and snapshot integrity. */
export class ResticTenantBackupAdapter implements ResticTenantBackupProvider {
  private readonly binary: string;

  constructor(private readonly config: ResticProviderConfig) {
    if (!config.repository.trim()) throw new Error("TENANT_BACKUP_RESTIC_REPOSITORY_REQUIRED");
    if (!config.passwordFile.trim() || !config.passwordFile.startsWith("/")) {
      throw new Error("TENANT_BACKUP_RESTIC_PASSWORD_FILE_REQUIRED");
    }
    this.binary = config.binary?.trim() || "restic";
    if (this.binary.length > 256 || /[\r\n\0]/.test(this.binary)) {
      throw new Error("TENANT_BACKUP_RESTIC_BINARY_INVALID");
    }
  }

  private async run(args: string[]): Promise<string> {
    const child = spawn(this.binary, args, {
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        RESTIC_REPOSITORY: this.config.repository,
        RESTIC_PASSWORD_FILE: this.config.passwordFile,
        RESTIC_CACHE_DIR: process.env.RESTIC_CACHE_DIR || undefined,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderrBytes = 0;
    child.stdout.setEncoding("utf8");
    child.stderr.on("data", (chunk: Buffer) => { stderrBytes += chunk.byteLength; });
    child.stdout.on("data", (chunk: string) => {
      if (stdout.length + chunk.length > 16 * 1024 * 1024) {
        child.kill("SIGTERM");
        return;
      }
      stdout += chunk;
    });
    const exitCode = await new Promise<number>((resolve, reject) => {
      child.once("error", (error) => {
        reject(error.code === "ENOENT"
          ? new Error("TENANT_BACKUP_RESTIC_NOT_INSTALLED")
          : new Error("TENANT_BACKUP_RESTIC_EXECUTION_FAILED"));
      });
      child.once("close", (code) => resolve(code ?? 1));
    });
    if (stdout.length > 16 * 1024 * 1024) throw new Error("TENANT_BACKUP_RESTIC_OUTPUT_TOO_LARGE");
    if (stderrBytes > 0 && exitCode !== 0) throw new Error("TENANT_BACKUP_RESTIC_FAILED");
    if (exitCode !== 0) throw new Error("TENANT_BACKUP_RESTIC_FAILED");
    return stdout;
  }

  async createSnapshot(input: {
    sourceDirectory: string;
    tenantId: string;
    backupId: string;
    schemaVersion: string;
  }): Promise<{ snapshotId: string }> {
    const tags = tenantBackupTags(input.tenantId);
    const stdout = await this.run([
      "backup",
      input.sourceDirectory,
      "--json",
      "--host", "bazion-tenant-backups",
      "--group-by", "host,tags",
      "--tag", tags.tenant,
      "--tag", `bazion-backup:${input.backupId}`,
      "--tag", `bazion-schema:${input.schemaVersion}`,
      "--tag", "bazion-format:1",
    ]);
    return { snapshotId: parseResticBackupSnapshotId(stdout) };
  }

  async listSnapshots(tenantId: string): Promise<ResticSnapshot[]> {
    const tags = tenantBackupTags(tenantId);
    const stdout = await this.run(["snapshots", "--json", "--tag", tags.tenant]);
    return parseResticSnapshots(stdout, tenantId);
  }

  async restoreSnapshot(input: {
    tenantId: string;
    snapshotId: string;
    targetDirectory: string;
  }): Promise<void> {
    const snapshots = await this.listSnapshots(input.tenantId);
    if (!snapshots.some((snapshot) => snapshot.id === input.snapshotId)) {
      throw new Error("TENANT_BACKUP_SNAPSHOT_NOT_FOUND");
    }
    await this.run(["restore", input.snapshotId, "--target", input.targetDirectory]);
  }
}
