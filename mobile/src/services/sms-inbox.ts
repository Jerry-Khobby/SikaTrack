/**
 * The phone's MoMo SMS, read by the app's own native module (modules/sms-inbox) and uploaded to
 * `POST /v1/sms/batches`. The module is in development and release builds only; in Expo Go
 * `canReadSms` is false and the app plays its stand-ins instead.
 */
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { ApiError, api } from '@/api/client';
import { getDeviceId } from '@/api/session';
import type { ApiSmsBatchResult, ApiSmsUpload } from '@/api/types';
import { uuid } from '@/utils/uuid';

export type InboxSms = { id: number; sender: string; dateMs: string; body: string };

type SmsInboxModule = {
  count(senders: string[], sinceMs: number): Promise<number>;
  read(senders: string[], sinceMs: number, afterDateMs: string | null, afterId: number, limit: number): Promise<InboxSms[]>;
};

const native = Platform.OS === 'android' ? requireOptionalNativeModule<SmsInboxModule>('SmsInbox') : null;

/** Whether this build can read SMS (a development or release build on Android). */
export const canReadSms = native !== null;

/** How many SMS from `senders` arrived after `sinceMs`. */
export function countInbox(senders: string[], sinceMs: number) {
  return native ? native.count(senders, sinceMs) : Promise.resolve(0);
}

const PAGE = 200;

/**
 * Every SMS from `senders` after `sinceMs`, oldest first, a page at a time; with `after`,
 * only those that come after that message (to carry on from it).
 */
export async function* readInbox(senders: string[], sinceMs: number, after?: InboxSms): AsyncGenerator<InboxSms[]> {
  if (!native) return;
  let last = after;
  for (;;) {
    const page = await native.read(senders, sinceMs, last?.dateMs ?? null, last?.id ?? 0, PAGE);
    if (page.length === 0) return;
    yield page;
    if (page.length < PAGE) return;
    last = page[page.length - 1];
  }
}

export type Limits = { maxMessages: number; maxBytes: number };

const encoder = new TextEncoder();
const bytes = (value: unknown) => encoder.encode(JSON.stringify(value)).length;

/**
 * Splits messages into batches the server accepts (`limits` from `GET /v1/config`), leaving
 * room in the byte limit for the rest of the request body.
 */
export function toBatches(messages: InboxSms[], limits: Limits): InboxSms[][] {
  const budget = limits.maxBytes - 1024;
  const batches: InboxSms[][] = [];
  let batch: InboxSms[] = [];
  let size = 0;
  for (const message of messages) {
    const n = bytes(message) + 1;
    if (batch.length > 0 && (batch.length >= limits.maxMessages || size + n > budget)) {
      batches.push(batch);
      batch = [];
      size = 0;
    }
    batch.push(message);
    size += n;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

const ATTEMPTS = 3;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Errors worth retrying: no connection, the server busy or away, or too many uploads at once. */
const retryable = (error: unknown) =>
  error instanceof ApiError && (error.status === 0 || error.status >= 500 || error.code === 'rate_limited');

/**
 * Uploads one batch. A retry reuses the same `Idempotency-Key`, so a batch the server got but
 * whose answer was lost isn't stored twice.
 */
export async function uploadBatch(source: ApiSmsUpload['source'], messages: InboxSms[]) {
  const body: ApiSmsUpload = {
    device_id: await getDeviceId(),
    source,
    messages: messages.map((m) => ({ sender: m.sender, date_ms: m.dateMs, body: m.body, android_id: m.id })),
  };
  const headers = { 'Idempotency-Key': uuid() };
  for (let attempt = 1; ; attempt++) {
    try {
      return await api.post<ApiSmsBatchResult>('/v1/sms/batches', body, headers);
    } catch (error) {
      if (attempt >= ATTEMPTS || !retryable(error)) throw error;
      const retryAfter = error instanceof ApiError && error.retryAfter ? error.retryAfter * 1000 : 0;
      await wait(Math.max(retryAfter, 2000 * attempt));
    }
  }
}
