import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/**
 * Tells TanStack Query whether the phone is online (G1). Offline, queries pause
 * and screens keep showing what they last loaded; back online, they refetch.
 * Call once at start-up; returns the unsubscribe.
 */
export function watchConnectivity() {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      // `isInternetReachable` is null until Android has checked; count that as online.
      setOnline(state.isConnected !== false && state.isInternetReachable !== false);
    }),
  );
  return () => onlineManager.setEventListener(() => undefined);
}
