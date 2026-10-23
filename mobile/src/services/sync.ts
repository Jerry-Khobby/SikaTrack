import { api } from '@/api/client';
import type { ApiSyncStatus } from '@/api/types';

import { getAppConfig } from './config';
import { readInbox, toBatches, uploadBatch } from './sms-inbox';

export type SyncStatus = {
  pendingMessages: number;
  provisionalTransactions: number;
  lastRunFailed: boolean;
  dataThrough: string | null;
  lastUploadAt: string | null;
  lastRun: { status: 'succeeded' | 'failed' | 'running'; finishedAt: string | null } | null;
  /** The newest SMS the server has, so "Sync now" only reads what came after it. */
  latestDateMs: string | null;
};

export type SyncState = 'up_to_date' | 'processing' | 'delayed';

/** `GET /v1/sync/status`: checked on start-up and on pull-to-refresh. */
export async function getSyncStatus(): Promise<SyncStatus> {
  const s = await api.get<ApiSyncStatus>('/v1/sync/status');
  return {
    pendingMessages: s.pending_messages,
    provisionalTransactions: s.provisional_transactions,
    lastRunFailed: s.last_pipeline_run?.status === 'failed',
    dataThrough: s.data_through,
    lastUploadAt: s.last_upload_at,
    lastRun: s.last_pipeline_run ? { status: s.last_pipeline_run.status, finishedAt: s.last_pipeline_run.finished_at } : null,
    latestDateMs: s.latest_date_ms,
  };
}

/** S34's headline: up to date, still working through something, or held up. */
export function syncState(status: Pick<SyncStatus, 'pendingMessages' | 'provisionalTransactions' | 'lastRunFailed'>): SyncState {
  if (status.lastRunFailed) return 'delayed';
  if (status.pendingMessages > 0 || status.provisionalTransactions > 0) return 'processing';
  return 'up_to_date';
}

/** Minutes of overlap when reading new SMS, so one that arrived mid-upload isn't missed. */
const SYNC_OVERLAP_MS = 10 * 60 * 1000;

/**
 * S34's **Sync now**: reads the MoMo SMS that came after the newest one the
 * server has (less ten minutes) and uploads them as `incremental`; the server
 * skips the ones it already has. Expo Go can't read SMS, so there it sends
 * nothing. Returns how many new messages the server took.
 */
export async function syncNow(status: Pick<SyncStatus, 'latestDateMs'>): Promise<number> {
  const config = await getAppConfig();
  const limits = { maxMessages: config.limits.smsBatchMaxMessages, maxBytes: config.limits.smsBatchMaxBytes };
  const since = status.latestDateMs ? Number(status.latestDateMs) - SYNC_OVERLAP_MS : 0;
  let accepted = 0;
  for await (const page of readInbox(config.momoSenders, since)) {
    for (const batch of toBatches(page, limits)) {
      accepted += (await uploadBatch('incremental', batch)).accepted;
    }
  }
  return accepted;
}

/** The sync strip's sentence on Home, or null when there's nothing to say (docs/ui-spec.md S12). */
export function syncMessage(status: Pick<SyncStatus, 'pendingMessages' | 'provisionalTransactions' | 'lastRunFailed'>) {
  if (status.pendingMessages > 0) {
    return `Syncing ${status.pendingMessages} new message${status.pendingMessages === 1 ? '' : 's'}…`;
  }
  if (status.provisionalTransactions > 0) {
    const n = status.provisionalTransactions;
    return `${n} recent payment${n === 1 ? ' is' : 's are'} still processing`;
  }
  if (status.lastRunFailed) {
    return 'Some payments are taking longer than usual';
  }
  return null;
}
