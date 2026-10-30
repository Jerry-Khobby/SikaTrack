// Safe-area insets come from native code; the library ships a mock for tests.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// The clipboard is native too.
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }));

// The in-app dev server answers at once in tests.
process.env.EXPO_PUBLIC_DEV_API_LATENCY_MS = '0';

// Connection state comes from native code too.
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));

// The secure store (Android Keystore) as an in-memory map.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (key) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key) => {
      store.delete(key);
    }),
  };
});

// Google sign-in's native module: a signed-in Google account unless a test says otherwise.
jest.mock('@react-native-google-signin/google-signin', () => {
  const statusCodes = {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  };
  return {
    GoogleSignin: {
      configure: jest.fn(),
      hasPlayServices: jest.fn().mockResolvedValue(true),
      signIn: jest.fn().mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token', user: {} } }),
      signOut: jest.fn().mockResolvedValue(null),
    },
    isSuccessResponse: (response) => response.type === 'success',
    isErrorWithCode: (error) => error != null && typeof error.code === 'string',
    statusCodes,
  };
});
