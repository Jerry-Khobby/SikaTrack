import { Linking, PermissionsAndroid } from 'react-native';

import { canReadSms } from './sms-inbox';

export type PermissionResult = 'granted' | 'denied';

/**
 * Android's READ_SMS prompt. Expo Go can't ask for it (only a build with the
 * app's SMS module can), so there it says yes and the first sync plays its stand-in.
 */
export async function requestSmsPermission(): Promise<PermissionResult> {
  if (!canReadSms) return 'granted';
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS);
  return result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
}

/** Whether the app may read SMS now (it can be turned off in Android settings at any time). */
export async function hasSmsPermission(): Promise<boolean> {
  if (!canReadSms) return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
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
