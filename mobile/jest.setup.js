// Safe-area insets come from native code; the library ships a mock for tests.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
