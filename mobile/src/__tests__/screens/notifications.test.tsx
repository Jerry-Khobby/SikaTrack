import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import NotificationsScreen from '@/app/notifications';
import { startSession } from '@/services/me';
import { listNotifications } from '@/services/notifications';
import { renderWithQuery, resetDevServer } from '@/test-utils';
import { routeForLink } from '@/utils/deep-links';

const mockRouter = { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() };

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => {
  jest.clearAllMocks();
  resetDevServer();
  startSession('+233241234567');
});

describe('S36 · Notifications inbox', () => {
  it('lists notifications with unread ones marked', async () => {
    const inbox = await listNotifications();
    await renderWithQuery(<NotificationsScreen />);

    for (const n of inbox.items) {
      expect(await screen.findByText(n.title)).toBeOnTheScreen();
    }
    expect(screen.getAllByRole('button', { name: /^Unread\./ })).toHaveLength(inbox.unread);
  });

  it('opens a notification’s link and marks it as read', async () => {
    const inbox = await listNotifications();
    const target = inbox.items.find((n) => !n.readAt && routeForLink(n.link))!;
    await renderWithQuery(<NotificationsScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^Unread\\. ${target.title}`) }));

    expect(mockRouter.navigate).toHaveBeenCalledWith(routeForLink(target.link));
    await waitFor(async () => expect((await listNotifications()).items.find((n) => n.id === target.id)?.readAt).not.toBeNull());
  });

  it('marks everything as read', async () => {
    await renderWithQuery(<NotificationsScreen />);
    await screen.findAllByRole('button', { name: /^Unread\./ });

    await fireEvent.press(screen.getByRole('button', { name: 'Mark all as read' }));

    await waitFor(() => expect(screen.queryAllByRole('button', { name: /^Unread\./ })).toHaveLength(0));
  });
});
