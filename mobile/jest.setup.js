// Safe-area insets come from native code; the library ships a mock for tests.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// The clipboard is native too.
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }));

// The in-app dev server answers at once in tests.
process.env.EXPO_PUBLIC_DEV_API_LATENCY_MS = '0';
