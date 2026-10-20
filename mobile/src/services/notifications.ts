import { api } from '@/api/client';
import type { ApiNotifications, NotificationKind } from '@/api/types';

export type { NotificationKind };

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  /** A `sikatrack://` deep link. */
  link: string | null;
};

export type NotificationInbox = { unread: number; items: AppNotification[] };

/** `GET /v1/notifications` */
export async function listNotifications(): Promise<NotificationInbox> {
  const response = await api.get<ApiNotifications>('/v1/notifications');
  return {
    unread: response.unread,
    items: response.items.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      createdAt: n.created_at,
      readAt: n.read_at,
      link: n.link,
    })),
  };
}

/** `POST /v1/notifications/{id}/read` */
export function markNotificationRead(id: string) {
  return api.post<void>(`/v1/notifications/${id}/read`);
}

/** `POST /v1/notifications/read-all` */
export function markAllNotificationsRead() {
  return api.post<void>('/v1/notifications/read-all');
}
