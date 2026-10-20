import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { Card } from '@/components/atoms';
import { EmptyState, ErrorState, NotificationRow } from '@/components/molecules';
import { DetailTemplate } from '@/components/templates';
import { requestIdOf } from '@/api/query-client';
import { useGoBack } from '@/hooks/use-go-back';
import { useTheme } from '@/hooks/use-theme';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/hooks/queries';
import type { AppNotification } from '@/services/notifications';
import { formatTimeAgo } from '@/utils/dates';
import { routeForLink } from '@/utils/deep-links';

/** S36 · Notifications inbox, opened from the bell on Home. */
export default function NotificationsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const goBack = useGoBack('/home');
  const inbox = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unread = inbox.data?.unread ?? 0;

  const open = (notification: AppNotification) => {
    if (!notification.readAt) markRead.mutate(notification.id);
    const route = routeForLink(notification.link);
    if (route) router.navigate(route);
  };

  const action = (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: unread === 0 }}
      disabled={unread === 0 || markAll.isPending}
      onPress={() => markAll.mutate()}
      className="h-touch justify-center px-2">
      <Text className={`font-sans-bold text-[13px] ${unread === 0 ? 'text-content-disabled' : 'text-link'}`}>
        Mark all as read
      </Text>
    </Pressable>
  );

  return (
    <DetailTemplate
      title="Notifications"
      onBack={goBack}
      action={action}
      gutter="narrow"
      refreshing={inbox.isRefetching}
      onRefresh={() => inbox.refetch()}>
      {inbox.isPending ? (
        <ActivityIndicator className="mt-16" color={theme.text} accessibilityLabel="Loading" />
      ) : inbox.isError ? (
        <ErrorState
          title="We couldn't load your notifications"
          requestId={requestIdOf(inbox.error)}
          onRetry={() => inbox.refetch()}
        />
      ) : inbox.data.items.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No notifications yet"
          message="Budget alerts, low balances and other heads-ups will land here."
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          {inbox.data.items.map((notification, index) => (
            <NotificationRow
              key={notification.id}
              kind={notification.kind}
              title={notification.title}
              body={notification.body}
              time={formatTimeAgo(notification.createdAt)}
              unread={!notification.readAt}
              onPress={() => open(notification)}
              divider={index < inbox.data.items.length - 1}
            />
          ))}
        </Card>
      )}
    </DetailTemplate>
  );
}

