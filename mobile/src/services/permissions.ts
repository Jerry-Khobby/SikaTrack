import { Linking } from 'react-native';

export type PermissionResult = 'granted' | 'denied';

/**
 * Android's READ_SMS prompt. Expo Go can't ask for it (it needs a development
 * build), so this says yes for now.
 */
export async function requestSmsPermission(): Promise<PermissionResult> {
  return 'granted';
}

/**
 * The system notification prompt, then `PUT /v1/devices/{id}` with the push
 * token. Needs expo-notifications in a development build; says yes for now.
 */
export async function requestNotificationPermission(): Promise<PermissionResult> {
  return 'granted';
}

/**
 * Whether Android lets the app show notifications at all (S31). Needs
 * expo-notifications in a development build; reports allowed until then.
 */
export async function getNotificationPermission(): Promise<PermissionResult> {
  return 'granted';
}

/** This app's page in Android settings, where permissions can be turned on. */
export function openAppSettings() {
  return Linking.openSettings();
}
