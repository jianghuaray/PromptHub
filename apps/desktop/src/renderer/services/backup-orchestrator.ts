import { downloadSelectiveExport } from "./database-backup";
import {
  type ManualBackupStatus,
  recordManualBackup,
} from "./backup-status";
import { createUpgradeBackup } from "./upgrade-backup";

export interface FullExportBackupOptions {
  currentVersion?: string;
  recordManualBackup?: boolean;
}

async function createSnapshotIfPossible(currentVersion?: string): Promise<void> {
  await createUpgradeBackup(
    currentVersion ? { fromVersion: currentVersion } : undefined,
  );
}

async function downloadExportFile(): Promise<void> {
  await downloadSelectiveExport({
    prompts: true,
    folders: true,
    versions: true,
    images: true,
    videos: true,
    aiConfig: true,
    settings: true,
    skills: true,
  });
}

export async function runFullExportBackup(
  options: FullExportBackupOptions,
): Promise<ManualBackupStatus | null> {
  await createSnapshotIfPossible(options.currentVersion);
  await downloadExportFile();

  if (options.recordManualBackup && options.currentVersion) {
    return recordManualBackup(options.currentVersion);
  }

  return null;
}

export async function runPreUpgradeBackup(
  currentVersion: string,
): Promise<ManualBackupStatus> {
  await createSnapshotIfPossible(currentVersion);
  await downloadExportFile();
  return recordManualBackup(currentVersion);
}
