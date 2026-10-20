import { api } from '@/api/client';
import type { ApiSyncStatus } from '@/api/types';

export type SyncStatus = {
  pendingMessages: number;
  provisionalTransactions: number;
  lastRunFailed: boolean;
  dataThrough: string | null;
};

/** `GET /v1/sync/status`: checked on start-up and on pull-to-refresh. */
export async function getSyncStatus(): Promise<SyncStatus> {
  const s = await api.get<ApiSyncStatus>('/v1/sync/status');
  return {
    pendingMessages: s.pending_messages,
    provisionalTransactions: s.provisional_transactions,
    lastRunFailed: s.last_pipeline_run?.status === 'failed',
    dataThrough: s.data_through,
  };
}

/** The sync strip's sentence on Home, or null when there's nothing to say (docs/ui-spec.md S12). */
export function syncMessage(status: SyncStatus) {
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
