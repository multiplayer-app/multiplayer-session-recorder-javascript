// Ambient module to prevent TypeScript errors when expo-constants is not installed.
// In non-Expo projects, this module is never required at runtime because we import
// through an optional shim that resolves to undefined.
declare module 'expo-constants' {
  const Constants: any;
  export default Constants;
}
