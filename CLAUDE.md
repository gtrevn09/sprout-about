# Sprout About

A local-first garden tracking app for managing plants, garden beds, care schedules, and layout design. No backend — all data lives in an on-device SQLite database.

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| Framework | Expo + React Native | ~54.0 / 0.81 |
| Routing | Expo Router (file-based) | ~6.0 |
| Database | expo-sqlite | ~16.0 |
| Auth state | React Context + AsyncStorage | — |
| Notifications | expo-notifications | ~0.32 |
| Gestures | react-native-gesture-handler | ~2.28 |
| Animations | react-native-reanimated | ~4.1 |
| Language | TypeScript (strict) | ~5.9 |

Path alias `@/` maps to repo root (`tsconfig.json`).

## Key Directories

```
app/                    Expo Router screens (file = route)
  (tabs)/               Tab navigator group (home, explore)
  bed/[id].tsx          Garden bed detail — plant list
  plant/[id].tsx        Plant detail — photos, logs, schedules
  layout.tsx            Visual garden layout designer (canvas + gestures)
  _layout.tsx           Root layout — AuthProvider, ThemeProvider, NotificationHandler
  index.tsx             Splash/redirect; calls initDatabase() on first load

lib/
  database.ts           All SQLite access — schema, migrations, typed CRUD functions
  notifications.ts      Schedule/cancel expo-notifications; returns stored IDs

context/
  auth.tsx              AuthProvider — userId in AsyncStorage, login/logout helpers

components/             Shared UI: ThemedText, GardenBackground, EmojiPicker, etc.
constants/
  theme.ts              Light/dark color tokens
hooks/                  useThemeColor, useColorScheme wrappers
assets/                 Images, icons, splash screen backgrounds
```

## Commands

```bash
expo start          # Start dev server (scan QR to open on device)
expo start --ios    # iOS simulator
expo start --android # Android emulator
expo lint           # ESLint (expo lint config)
```

No test suite exists yet.

## Database

Single file: `lib/database.ts` (~581 lines). Twelve tables; schema migrations run inside `initDatabase()` via `ALTER TABLE` guards. All queries use `db.runSync` / `db.getFirstSync` / `db.getAllSync` — synchronous, no async/await in database calls. See `lib/database.ts:1` for full schema.

## Authentication

SHA-256 password hashing via `expo-crypto`. User ID is persisted to AsyncStorage and restored on app start by `AuthProvider` (`context/auth.tsx`). `useAuth()` is the consumer hook.

## Notifications

Notification IDs returned by `scheduleFertilizerReminder` / `scheduleTreatmentReminder` (`lib/notifications.ts`) are stored in the database so they can be cancelled on schedule changes. A tap-handler in `app/_layout.tsx` routes the user to the relevant plant screen with `showConfirm=true`.

## Additional Documentation

Check these files when working in the relevant area:

- [`.claude/docs/architectural_patterns.md`](.claude/docs/architectural_patterns.md) — recurring code patterns: DB access, screen lifecycle, navigation, theming, modal forms, gesture canvas
