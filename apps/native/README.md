# PACT native authentication proof

This Expo development client is the Phase 0 native shell. It uses the system browser for authorization-code + PKCE login, accepts only the configured HTTPS app-link callback, stores the rotating refresh token and pending PKCE verifier in `expo-secure-store`, and keeps the access token only in memory.

`app.json` disables Android SecureStore backup and declares the placeholder `pact.example` universal/app-link association. Before a signed device build, replace that host with the VPS hostname and publish the Apple association and Android asset-links files from the same origin. Never substitute a custom-scheme callback for the verified production callback.

```sh
npm run build --workspace @pact/native
npm test -- apps/native/src/session-controller.test.ts
npm run dev --workspace @pact/native
```

Local tests prove callback/state/audience validation, single-use PKCE state, refresh rotation, access-token memory-only behavior, duplicate approval suppression, and server-state reload without initiating a run. PACT-084 remains externally blocked until the same flows are exercised in signed iOS and Android development builds on devices.
