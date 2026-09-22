# PACT native authentication proof

This Expo development client is the Phase 0 native shell. It uses the system browser for authorization-code + PKCE login, accepts only the configured HTTPS app-link callback, stores the rotating refresh token in `expo-secure-store`, and keeps the access token only in memory.

`app.json` disables Android SecureStore backup and declares the single-VPS `safa.dedyn.io` universal/app-link association. Build with `EXPO_PUBLIC_PACT_ORIGIN=https://safa.dedyn.io/pact`. Before a signed device build, publish Apple and Android association files from the hostname root using the actual Apple team ID and Android signing-certificate fingerprint. Never substitute a custom-scheme callback for the verified production callback.

The Phase 0 screen restores and rotates the refresh credential on launch, reloads private server state when the app becomes active, submits an idempotent sandbox command, reviews and commits an exact approval, coalesces duplicate approval taps, and revokes the connection. Access tokens remain only in React state; request failures display only a stable error code.

```sh
npm run build --workspace @pact/native
node --run test -- apps/native/src/session-controller.test.ts apps/native/src/native-api.test.ts
npm run dev --workspace @pact/native
```

Local tests prove callback/state/audience validation, single-use PKCE state, refresh rotation, access-token memory-only behavior, duplicate approval suppression, and server-state reload without initiating a run. PACT-084 remains externally blocked until the same flows are exercised in signed iOS and Android development builds on devices.
