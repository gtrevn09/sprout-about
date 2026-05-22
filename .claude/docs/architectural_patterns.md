# Architectural Patterns

Patterns that appear in multiple files across the codebase.

---

## 1. Database Access — Synchronous Raw SQL

All DB calls are synchronous. There is no ORM and no async/await in `lib/database.ts`.

```
db.runSync(sql, [...params])          // INSERT / UPDATE / DELETE
db.getFirstSync(sql, [...params])     // SELECT one row → typed object or null
db.getAllSync(sql, [...params])        // SELECT many rows → typed array
```

TypeScript interfaces for each entity are defined and exported from `lib/database.ts` (e.g., `Plant`, `GardenBed`, `LayoutShape`). Screens import these types directly; there is no separate types/ directory.

Parameterized placeholders (`?`) are used everywhere — no string interpolation in queries.

---

## 2. Screen Data Refresh — useFocusEffect

Screens that display DB data re-fetch on every focus event, not just on mount. Pattern used in `app/(tabs)/home.tsx`, `app/bed/[id].tsx`, `app/plant/[id].tsx`:

```tsx
useFocusEffect(
  useCallback(() => {
    // call DB functions, setState
  }, [id])  // dependency is usually the route param
);
```

This ensures stale data is never shown after navigating back from a child screen.

---

## 3. Navigation

Expo Router's typed `router` object is used throughout:

```tsx
router.push({ pathname: '/plant/[id]', params: { id: plant.id } });
router.replace('/login');   // auth redirects use replace, not push
router.back();
```

A `navigatingRef = useRef(false)` guard prevents double-taps from pushing duplicate screens (`app/bed/[id].tsx`, `app/(tabs)/home.tsx`). Set it to `true` before navigating, reset in `useFocusEffect`.

---

## 4. Authentication State

`context/auth.tsx` exposes `useAuth()` → `{ userId, login, logout, isLoading }`.

- On app start, `AuthProvider` reads `userId` from AsyncStorage; `isLoading` is `true` until resolved.
- `app/index.tsx` waits for `isLoading === false`, then redirects to `/login` or `/(tabs)/home`.
- Screens that need the current user call `useAuth().userId`.

---

## 5. Theming

Every screen uses `useThemeColor` (from `hooks/useThemeColor.ts`) or reads `Colors` from `constants/theme.ts` directly. `useColorScheme()` provides `'light' | 'dark'`.

Screens wrap their root view with `<GardenBackground>` (`components/GardenBackground.tsx`), which renders a background image with a semi-transparent overlay, replacing plain `<View>` containers.

Conditional color values are inline:

```tsx
const bg = colorScheme === 'dark' ? Colors.dark.background : Colors.light.background;
```

---

## 6. Modal Forms

All create/edit interactions use a local `modalVisible` boolean and a set of `useState` fields for the form inputs. The pattern (used in home, bed detail, plant detail):

1. `const [showAddModal, setShowAddModal] = useState(false)`
2. Form fields initialized to empty strings / defaults
3. `<Modal visible={showAddModal} animationType="slide" transparent>`
4. Cancel button resets fields and closes; Save button validates, writes to DB, refreshes list, closes
5. `Alert.alert()` is used for destructive confirmations (delete)

---

## 7. Notification ID Lifecycle

When a schedule is saved, `scheduleFertilizerReminder` / `scheduleTreatmentReminder` returns a string notification ID. That ID is written to the `plant_schedules` or `treatment_schedules` table alongside the schedule config.

On schedule update or delete: the old notification ID is read from the DB, `cancelScheduledNotificationAsync(id)` is called, then the new one is scheduled and its ID saved. This keeps device notifications in sync with DB state.

---

## 8. Gesture Canvas (layout.tsx)

`app/layout.tsx` is the only screen using advanced gestures. Key points:

- `useSharedValue` / `useAnimatedStyle` from `react-native-reanimated` drive shape position and rotation.
- `Gesture.Pan()`, `Gesture.Rotation()`, `Gesture.LongPress()`, `Gesture.Tap()` from `react-native-gesture-handler` are composed with `Gesture.Simultaneous()` / `Gesture.Race()`.
- Collision detection uses AABB (axis-aligned bounding box) overlap checks to block shapes from overlapping.
- Snap-to-angle: rotation snaps to 0°/90°/180°/270° when within a threshold.
- `savedExpandedIds` is a module-level variable (outside the component) to persist expanded-layout state across navigations without AsyncStorage.
- Shapes are persisted to `layout_shapes` table after every pan/rotation gesture ends (`onEnd` callback calls `updateShapeTransform`).
