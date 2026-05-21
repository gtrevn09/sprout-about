import { GardenBackground } from '@/components/garden-background';
import { useAuth } from '@/context/auth';
import {
  addLayoutShape,
  createLayout,
  deleteLayout,
  deleteLayoutShape,
  GardenBed,
  GardenLayout,
  getGardenBeds,
  getLayouts,
  getLayoutShapes,
  getOrCreateDefaultLayout,
  getPlants,
  LayoutShape,
  renameLayout,
  reorderLayouts,
  updateLayoutCanvas,
  updateLayoutShape,
  updateShapeTransform,
} from '@/lib/database';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated as RNAnimated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const H_PAD = 20;
const CANVAS_MAX_W = SCREEN_W - H_PAD * 2;
const CANVAS_MAX_H = SCREEN_H - 340;
const CARD_HEADER_H = 56;

const SHAPE_COLORS = [
  '#c8e6c9', '#a5d6a7', '#d7ccc8', '#b3e5fc',
  '#fff9c4', '#ffe0b2', '#e1bee7',
];

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function snapAngle(r: number): number {
  const SNAP = 0.2;
  const twoPi = Math.PI * 2;
  const norm = ((r % twoPi) + twoPi) % twoPi;
  const cardinals = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, twoPi];
  for (const c of cardinals) {
    if (Math.abs(norm - c) < SNAP) return r + (c - norm);
  }
  return r;
}

function aabbOverlap(
  ax: number, ay: number, aw: number, ah: number, ar: number,
  bx: number, by: number, bw: number, bh: number, br: number
): boolean {
  const cosA = Math.abs(Math.cos(ar)), sinA = Math.abs(Math.sin(ar));
  const cosB = Math.abs(Math.cos(br)), sinB = Math.abs(Math.sin(br));
  const aAW = cosA * aw + sinA * ah, aAH = sinA * aw + cosA * ah;
  const bAW = cosB * bw + sinB * bh, bAH = sinB * bw + cosB * bh;
  const aCX = ax + aw / 2, aCY = ay + ah / 2;
  const bCX = bx + bw / 2, bCY = by + bh / 2;
  return Math.abs(aCX - bCX) < (aAW + bAW) / 2 &&
         Math.abs(aCY - bCY) < (aAH + bAH) / 2;
}

// ── DraggableShape ─────────────────────────────────────────────────────────────

type DSProps = {
  shape: LayoutShape;
  scale: number;
  canvasWFt: number;
  canvasHFt: number;
  otherShapes: LayoutShape[];
  plantCount: number;
  linkedBedName: string | null;
  onTap: () => void;
  onTransformSave: (id: number, x: number, y: number, rotation: number) => void;
};

const HANDLE_SIZE = 34;

function DraggableShape({
  shape, scale, canvasWFt, canvasHFt, otherShapes,
  plantCount, linkedBedName, onTap, onTransformSave,
}: DSProps) {
  const [rotMode, setRotMode] = useState(false);

  const posX = useSharedValue(shape.x * scale);
  const posY = useSharedValue(shape.y * scale);
  const rotation = useSharedValue(shape.rotation);
  const savedX = useSharedValue(shape.x * scale);
  const savedY = useSharedValue(shape.y * scale);
  const savedRot = useSharedValue(shape.rotation);

  const othersRef = useRef(otherShapes);
  othersRef.current = otherShapes;

  useEffect(() => {
    posX.value = shape.x * scale;
    posY.value = shape.y * scale;
    rotation.value = shape.rotation;
    savedX.value = shape.x * scale;
    savedY.value = shape.y * scale;
    savedRot.value = shape.rotation;
  }, [shape.x, shape.y, shape.rotation, scale]);

  const pxW = shape.width_ft * scale;
  const pxH = shape.height_ft * scale;
  const isCircle = shape.shape_type === 'circle';
  const textRotated = !isCircle && pxH > pxW * 1.4;

  const longPress = Gesture.LongPress()
    .runOnJS(true)
    .minDuration(500)
    .maxDistance(8)
    .onStart(() => setRotMode(true));

  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .maxDuration(400)
    .onEnd(() => {
      if (rotMode) setRotMode(false);
      else onTap();
    });

  const movePan = Gesture.Pan()
    .runOnJS(true)
    .enabled(!rotMode)
    .activeOffsetX([-8, 8])
    .activeOffsetY([-8, 8])
    .onBegin(() => {
      savedX.value = posX.value;
      savedY.value = posY.value;
    })
    .onUpdate((e) => {
      const myW = shape.width_ft * scale;
      const myH = shape.height_ft * scale;
      const rot = rotation.value;
      const cosA = Math.abs(Math.cos(rot));
      const sinA = Math.abs(Math.sin(rot));
      const aabbW = cosA * myW + sinA * myH;
      const aabbH = sinA * myW + cosA * myH;
      const canvasPxW = canvasWFt * scale;
      const canvasPxH = canvasHFt * scale;
      const minX = aabbW / 2 - myW / 2;
      const maxX = canvasPxW - myW / 2 - aabbW / 2;
      const minY = aabbH / 2 - myH / 2;
      const maxY = canvasPxH - myH / 2 - aabbH / 2;
      const targetX = clamp(savedX.value + e.translationX, minX, maxX);
      const targetY = clamp(savedY.value + e.translationY, minY, maxY);

      const hits = (x: number, y: number) => othersRef.current.some(o =>
        aabbOverlap(x, y, myW, myH, rot,
          o.x * scale, o.y * scale, o.width_ft * scale, o.height_ft * scale, o.rotation)
      );

      if (!hits(targetX, targetY)) {
        posX.value = targetX; posY.value = targetY;
      } else if (!hits(targetX, posY.value)) {
        posX.value = targetX;
      } else if (!hits(posX.value, targetY)) {
        posY.value = targetY;
      }
    })
    .onEnd(() => {
      const SNAP = 12;
      const rot = rotation.value;
      const cosA = Math.abs(Math.cos(rot));
      const sinA = Math.abs(Math.sin(rot));
      const myW = shape.width_ft * scale;
      const myH = shape.height_ft * scale;
      const aabbW = cosA * myW + sinA * myH;
      const aabbH = sinA * myW + cosA * myH;
      const canvasPxW = canvasWFt * scale;
      const canvasPxH = canvasHFt * scale;
      const minX = aabbW / 2 - myW / 2;
      const maxX = canvasPxW - myW / 2 - aabbW / 2;
      const minY = aabbH / 2 - myH / 2;
      const maxY = canvasPxH - myH / 2 - aabbH / 2;
      let nx = posX.value;
      let ny = posY.value;
      if (nx - minX < SNAP) nx = minX;
      else if (maxX - nx < SNAP) nx = maxX;
      if (ny - minY < SNAP) ny = minY;
      else if (maxY - ny < SNAP) ny = maxY;
      posX.value = nx; posY.value = ny;
      onTransformSave(shape.id, nx / scale, ny / scale, rotation.value);
    });

  const twoFingerRot = Gesture.Rotation()
    .runOnJS(true)
    .enabled(!rotMode)
    .onBegin(() => { savedRot.value = rotation.value; })
    .onUpdate((e) => { rotation.value = savedRot.value + e.rotation; })
    .onEnd(() => {
      const snapped = snapAngle(rotation.value);
      rotation.value = snapped;
      onTransformSave(shape.id, posX.value / scale, posY.value / scale, snapped);
    });

  const handlePan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-6, 6])
    .activeOffsetY([-6, 6])
    .onBegin(() => { savedRot.value = rotation.value; })
    .onUpdate((e) => {
      rotation.value = savedRot.value + e.translationX * (Math.PI / 160);
    })
    .onEnd(() => {
      const snapped = snapAngle(rotation.value);
      rotation.value = snapped;
      onTransformSave(shape.id, posX.value / scale, posY.value / scale, snapped);
      setRotMode(false);
    });

  const mainGesture = Gesture.Race(
    longPress,
    tapGesture,
    Gesture.Simultaneous(movePan, twoFingerRot)
  );

  const animStyle = useAnimatedStyle(() => ({
    left: posX.value,
    top: posY.value,
    transform: [{ rotate: `${rotation.value}rad` }],
  }));

  return (
    <GestureDetector gesture={mainGesture}>
      <Animated.View
        style={[
          ss.shapeOuter,
          {
            width: pxW,
            height: pxH,
            backgroundColor: shape.color,
            borderRadius: isCircle ? pxW / 2 : 6,
            borderColor: rotMode ? '#3a7d44' : 'rgba(0,0,0,0.18)',
            borderWidth: rotMode ? 2.5 : 1.5,
          },
          animStyle,
        ]}
      >
        <View style={textRotated ? [ss.shapeInner, { overflow: 'visible' }] : ss.shapeInner} pointerEvents="none">
          {textRotated ? (
            <View style={{ width: pxH, height: pxW, alignItems: 'center', justifyContent: 'center', padding: 3, transform: [{ rotate: '-90deg' }] }}>
              {shape.label ? <Text style={ss.label} numberOfLines={1} adjustsFontSizeToFit>{shape.label}</Text> : null}
              {linkedBedName ? <Text style={ss.bedLink} numberOfLines={1}>🌱 {linkedBedName}</Text> : null}
            </View>
          ) : (
            <>
              {shape.label ? <Text style={ss.label} numberOfLines={2} adjustsFontSizeToFit>{shape.label}</Text> : null}
              <Text style={ss.dims}>{shape.width_ft}×{shape.height_ft}ft</Text>
              {linkedBedName ? <Text style={ss.bedLink} numberOfLines={1}>🌱 {linkedBedName}</Text> : null}
            </>
          )}
          {plantCount > 0 ? (
            <View style={ss.badge}><Text style={ss.badgeText}>{plantCount}</Text></View>
          ) : null}
        </View>

        {rotMode && (
          <GestureDetector gesture={handlePan}>
            <View style={[ss.rotHandle, { top: -(HANDLE_SIZE + 6), left: pxW / 2 - HANDLE_SIZE / 2 }]}>
              <Text style={ss.rotHandleText}>↻</Text>
            </View>
          </GestureDetector>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const ss = StyleSheet.create({
  shapeOuter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shapeInner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
    overflow: 'hidden',
  },
  label: { fontSize: 11, fontWeight: '700', color: '#1a3d20', textAlign: 'center' },
  dims: { fontSize: 9, color: '#555', textAlign: 'center' },
  bedLink: { fontSize: 9, color: '#3a7d44', textAlign: 'center', marginTop: 1 },
  badge: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: '#3a7d44', borderRadius: 7,
    minWidth: 14, height: 14, paddingHorizontal: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  rotHandle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: '#3a7d44',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 6,
  },
  rotHandleText: { color: '#fff', fontSize: 20, fontWeight: '700', lineHeight: 22 },
});

// ── Color picker ───────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <View style={cp.row}>
      {SHAPE_COLORS.map(c => (
        <Pressable
          key={c}
          style={[cp.circle, { backgroundColor: c }, value === c && cp.selected]}
          onPress={() => onChange(c)}
        />
      ))}
    </View>
  );
}

const cp = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  circle: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  selected: { borderColor: '#3a7d44', borderWidth: 3 },
});

// ── LayoutCard ─────────────────────────────────────────────────────────────────

type LayoutCardProps = {
  layout: GardenLayout;
  isExpanded: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  index: number;
  total: number;
  onReorder: (fromIdx: number, toIdx: number) => void;
  onReorderEnd: () => void;
  userId: number;
  beds: GardenBed[];
  plantCounts: Record<number, number>;
  router: ReturnType<typeof useRouter>;
};

function LayoutCard({
  layout, isExpanded, onToggle, onRename, onDelete,
  index, total, onReorder, onReorderEnd,
  userId, beds, plantCounts, router,
}: LayoutCardProps) {
  const [shapes, setShapes] = useState<LayoutShape[]>([]);
  const [canvasW, setCanvasW] = useState(layout.canvas_width_ft);
  const [canvasH, setCanvasH] = useState(layout.canvas_height_ft);
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState(layout.name);

  // Stable refs so the drag gesture (created once) never stales
  const indexRef = useRef(index);
  indexRef.current = index;
  const totalRef = useRef(total);
  totalRef.current = total;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;
  const onReorderEndRef = useRef(onReorderEnd);
  onReorderEndRef.current = onReorderEnd;

  const dragStartIdx = useRef(index);

  // RNAnimated.Value is set via setValue() on the JS thread — immediately visible,
  // no Reanimated worklet compilation needed. useNativeDriver:true on the spring
  // gives a smooth snap-back on release.
  const dragY = useRef(new RNAnimated.Value(0)).current;
  const [isDragging, setIsDragging] = useState(false);

  // Created once — refs keep it up-to-date without recreating the gesture object
  const dragGesture = useMemo(() =>
    Gesture.Pan()
      .runOnJS(true)
      .minDistance(4)
      .activeOffsetY([-8, 8])
      .failOffsetX([-12, 12])
      .onBegin(() => {
        dragStartIdx.current = indexRef.current;
        dragY.setValue(0);
        setIsDragging(true);
      })
      .onUpdate((e) => {
        dragY.setValue(e.translationY);
      })
      .onEnd((e) => {
        const delta = Math.round(e.translationY / CARD_HEADER_H);
        const target = clamp(dragStartIdx.current + delta, 0, totalRef.current - 1);
        if (target !== indexRef.current) {
          onReorderRef.current(indexRef.current, target);
        }
        onReorderEndRef.current();
        RNAnimated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 20,
          stiffness: 300,
          mass: 1,
        }).start(() => setIsDragging(false));
      }),
  []);

  const [addVisible, setAddVisible] = useState(false);
  const [addType, setAddType] = useState<'rectangle' | 'circle'>('rectangle');
  const [addLabel, setAddLabel] = useState('');
  const [addW, setAddW] = useState('4');
  const [addH, setAddH] = useState('4');
  const [addColor, setAddColor] = useState(SHAPE_COLORS[0]);
  const [addBedId, setAddBedId] = useState<number | null>(null);

  const [editShape, setEditShape] = useState<LayoutShape | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editW, setEditW] = useState('');
  const [editH, setEditH] = useState('');
  const [editColor, setEditColor] = useState(SHAPE_COLORS[0]);
  const [editBedId, setEditBedId] = useState<number | null>(null);

  const [canvasVisible, setCanvasVisible] = useState(false);
  const [canvasWIn, setCanvasWIn] = useState('');
  const [canvasHIn, setCanvasHIn] = useState('');

  useEffect(() => {
    setCanvasW(layout.canvas_width_ft);
    setCanvasH(layout.canvas_height_ft);
  }, [layout.canvas_width_ft, layout.canvas_height_ft]);

  useEffect(() => {
    if (isExpanded) setShapes(getLayoutShapes(layout.id));
  }, [isExpanded, layout.id]);

  const scaleByW = CANVAS_MAX_W / canvasW;
  const scaleByH = CANVAS_MAX_H / canvasH;
  const scale = Math.min(scaleByW, scaleByH);
  const canvasPxW = Math.round(canvasW * scale);
  const canvasPxH = Math.round(canvasH * scale);

  function handleAddShape() {
    const w = Math.max(0.5, parseFloat(addW) || 4);
    const h = addType === 'circle' ? w : Math.max(0.5, parseFloat(addH) || 4);
    addLayoutShape(userId, layout.id, addType, 0, 0, w, h, addLabel.trim() || null, addColor, addBedId);
    setShapes(getLayoutShapes(layout.id));
    setAddVisible(false);
    resetAddForm();
  }

  function resetAddForm() {
    setAddLabel(''); setAddW('4'); setAddH('4');
    setAddType('rectangle'); setAddColor(SHAPE_COLORS[0]); setAddBedId(null);
  }

  function openEdit(shape: LayoutShape) {
    setEditShape(shape);
    setEditLabel(shape.label ?? '');
    setEditW(String(shape.width_ft));
    setEditH(String(shape.height_ft));
    setEditColor(shape.color);
    setEditBedId(shape.bed_id);
  }

  function handleSaveEdit() {
    if (!editShape) return;
    const w = Math.max(0.5, parseFloat(editW) || editShape.width_ft);
    const h = editShape.shape_type === 'circle' ? w : Math.max(0.5, parseFloat(editH) || editShape.height_ft);
    updateLayoutShape(editShape.id, editLabel.trim() || null, w, h, editColor, editBedId);
    setShapes(getLayoutShapes(layout.id));
    setEditShape(null);
  }

  function handleDeleteShape() {
    if (!editShape) return;
    Alert.alert('Delete Shape', 'Remove this shape from the layout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        deleteLayoutShape(editShape.id);
        setShapes(getLayoutShapes(layout.id));
        setEditShape(null);
      }},
    ]);
  }

  function handleSaveCanvas() {
    const w = Math.max(1, parseFloat(canvasWIn) || canvasW);
    const h = Math.max(1, parseFloat(canvasHIn) || canvasH);
    updateLayoutCanvas(layout.id, w, h);
    setCanvasW(w);
    setCanvasH(h);
    setCanvasVisible(false);
    // Clamp any shapes that now fall outside the new canvas bounds (feet units)
    setShapes(prev => prev.map(shape => {
      const mw = shape.width_ft, mh = shape.height_ft;
      const rot = shape.rotation;
      const cosA = Math.abs(Math.cos(rot)), sinA = Math.abs(Math.sin(rot));
      const aabbW = cosA * mw + sinA * mh;
      const aabbH = sinA * mw + cosA * mh;
      const minX = aabbW / 2 - mw / 2;
      const maxX = Math.max(minX, w - mw / 2 - aabbW / 2);
      const minY = aabbH / 2 - mh / 2;
      const maxY = Math.max(minY, h - mh / 2 - aabbH / 2);
      const nx = clamp(shape.x, minX, maxX);
      const ny = clamp(shape.y, minY, maxY);
      if (nx !== shape.x || ny !== shape.y) {
        updateShapeTransform(shape.id, nx, ny, rot);
        return { ...shape, x: nx, y: ny };
      }
      return shape;
    }));
  }

  function handleTransformSave(id: number, x: number, y: number, rotation: number) {
    updateShapeTransform(id, x, y, rotation);
    setShapes(prev => prev.map(s => s.id === id ? { ...s, x, y, rotation } : s));
  }

  function handleRenameSubmit() {
    const trimmed = renameText.trim();
    if (trimmed) onRename(trimmed);
    setRenaming(false);
  }

  return (
    <RNAnimated.View style={[
      lc.card,
      isDragging && lc.cardLifted,
      { transform: [{ translateY: dragY }] },
    ]}>
      {/* ── Wood plank top ── */}
      <View style={lc.plankTop}>
        <View style={lc.woodKnot} />
        <View style={[lc.woodGrain, { left: '28%' }]} />
        <View style={[lc.woodGrain, { left: '60%' }]} />
        <View style={[lc.woodGrain, { left: '82%' }]} />
      </View>

      {/* ── Card Header ── */}
      <View style={lc.header}>
        <GestureDetector gesture={dragGesture}>
          <View style={lc.dragHandle}>
            <Text style={lc.dragIcon}>≡</Text>
          </View>
        </GestureDetector>

        <Pressable style={lc.titleArea} onPress={onToggle}>
          {renaming ? (
            <TextInput
              style={lc.renameInput}
              value={renameText}
              onChangeText={setRenameText}
              onBlur={handleRenameSubmit}
              onSubmitEditing={handleRenameSubmit}
              autoFocus
            />
          ) : (
            <Text style={lc.title} numberOfLines={1}>{layout.name}</Text>
          )}
        </Pressable>

        {!renaming && (
          <Pressable
            style={lc.iconBtn}
            onPress={() => { setRenameText(layout.name); setRenaming(true); }}
          >
            <Text style={lc.iconTxt}>✎</Text>
          </Pressable>
        )}

        <Pressable
          style={lc.iconBtn}
          onPress={() => Alert.alert(
            'Delete Layout',
            `Delete "${layout.name}" and all its shapes?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: onDelete },
            ]
          )}
        >
          <Text style={[lc.iconTxt, { color: '#c0392b' }]}>✕</Text>
        </Pressable>

        <Pressable style={lc.chevronBtn} onPress={onToggle}>
          <Text style={lc.chevron}>{isExpanded ? '▲' : '▼'}</Text>
        </Pressable>
      </View>

      {/* ── Expanded Body ── */}
      {isExpanded && (
        <View style={lc.body}>
          <View style={lc.canvasRow}>
            <Text style={lc.canvasInfo}>
              {canvasW}ft × {canvasH}ft · tap to edit · hold to rotate
            </Text>
            <Pressable
              style={lc.canvasBtn}
              onPress={() => {
                setCanvasWIn(String(canvasW));
                setCanvasHIn(String(canvasH));
                setCanvasVisible(true);
              }}
            >
              <Text style={lc.canvasBtnText}>⚙ Size</Text>
            </Pressable>
          </View>

          <View style={[lc.canvas, { width: canvasPxW, height: canvasPxH }]}>
            {shapes.length === 0 && (
              <Text style={lc.canvasEmpty}>Tap "+ Add Shape" to place your first garden bed</Text>
            )}
            {shapes.map(shape => (
              <DraggableShape
                key={shape.id}
                shape={shape}
                scale={scale}
                canvasWFt={canvasW}
                canvasHFt={canvasH}
                otherShapes={shapes.filter(s => s.id !== shape.id)}
                plantCount={shape.bed_id ? (plantCounts[shape.bed_id] ?? 0) : 0}
                linkedBedName={shape.bed_id ? (beds.find(b => b.id === shape.bed_id)?.name ?? null) : null}
                onTap={() => openEdit(shape)}
                onTransformSave={handleTransformSave}
              />
            ))}
          </View>

          <Pressable style={[lc.addBtn, { width: canvasPxW }]} onPress={() => setAddVisible(true)}>
            <Text style={lc.addBtnText}>+ Add Shape</Text>
          </Pressable>
        </View>
      )}

      {/* ── Wood plank bottom ── */}
      <View style={lc.plankBottom}>
        <View style={[lc.woodGrain, { left: '15%' }]} />
        <View style={[lc.woodGrain, { left: '50%' }]} />
        <View style={[lc.woodGrain, { left: '75%' }]} />
      </View>

      {/* ── Add Shape Modal ── */}
      <Modal visible={addVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.overlayScroll}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Add Shape</Text>
              <View style={styles.typeRow}>
                {(['rectangle', 'circle'] as const).map(t => (
                  <Pressable
                    key={t}
                    style={[styles.typeBtn, addType === t && styles.typeBtnOn]}
                    onPress={() => setAddType(t)}
                  >
                    <Text style={[styles.typeTxt, addType === t && styles.typeTxtOn]}>
                      {t === 'rectangle' ? '▭  Rectangle' : '●  Circle / Round'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.lbl}>Name (optional)</Text>
              <TextInput
                style={styles.input}
                value={addLabel}
                onChangeText={setAddLabel}
                placeholder="e.g., Tomatoes, Herb Spiral"
                placeholderTextColor="#aaa"
              />
              <Text style={styles.lbl}>{addType === 'circle' ? 'Diameter (ft)' : 'Width (ft)'}</Text>
              <TextInput
                style={styles.input}
                value={addW}
                onChangeText={setAddW}
                keyboardType="decimal-pad"
                placeholder="4"
                placeholderTextColor="#aaa"
              />
              {addType === 'rectangle' && (
                <>
                  <Text style={styles.lbl}>Height (ft)</Text>
                  <TextInput
                    style={styles.input}
                    value={addH}
                    onChangeText={setAddH}
                    keyboardType="decimal-pad"
                    placeholder="8"
                    placeholderTextColor="#aaa"
                  />
                </>
              )}
              <Text style={styles.lbl}>Color</Text>
              <ColorPicker value={addColor} onChange={setAddColor} />
              <Text style={styles.lbl}>Link to Garden Bed</Text>
              <View style={styles.chipRow}>
                <Pressable
                  style={[styles.chip, addBedId === null && styles.chipOn]}
                  onPress={() => setAddBedId(null)}
                >
                  <Text style={[styles.chipTxt, addBedId === null && styles.chipTxtOn]}>None</Text>
                </Pressable>
                {beds.map(b => (
                  <Pressable
                    key={b.id}
                    style={[styles.chip, addBedId === b.id && styles.chipOn]}
                    onPress={() => setAddBedId(b.id)}
                  >
                    <Text style={[styles.chipTxt, addBedId === b.id && styles.chipTxtOn]}>{b.name}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.modalBtns}>
                <Pressable style={styles.btnCancel} onPress={() => { setAddVisible(false); resetAddForm(); }}>
                  <Text style={styles.btnCancelTxt}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.btnSave} onPress={handleAddShape}>
                  <Text style={styles.btnSaveTxt}>Add</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Edit Shape Modal ── */}
      <Modal visible={!!editShape} transparent animationType="fade">
        <View style={styles.overlay}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.overlayScroll}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Edit Shape</Text>
              <Text style={styles.lbl}>Name</Text>
              <TextInput
                style={styles.input}
                value={editLabel}
                onChangeText={setEditLabel}
                placeholder="e.g., Tomatoes"
                placeholderTextColor="#aaa"
              />
              <Text style={styles.lbl}>{editShape?.shape_type === 'circle' ? 'Diameter (ft)' : 'Width (ft)'}</Text>
              <TextInput
                style={styles.input}
                value={editW}
                onChangeText={setEditW}
                keyboardType="decimal-pad"
                placeholder="4"
                placeholderTextColor="#aaa"
              />
              {editShape?.shape_type === 'rectangle' && (
                <>
                  <Text style={styles.lbl}>Height (ft)</Text>
                  <TextInput
                    style={styles.input}
                    value={editH}
                    onChangeText={setEditH}
                    keyboardType="decimal-pad"
                    placeholder="8"
                    placeholderTextColor="#aaa"
                  />
                </>
              )}
              <Text style={styles.lbl}>Color</Text>
              <ColorPicker value={editColor} onChange={setEditColor} />
              <Text style={styles.lbl}>Link to Garden Bed</Text>
              <Text style={styles.sublbl}>Once linked, tap "Open Bed" to navigate to it.</Text>
              <View style={styles.chipRow}>
                <Pressable
                  style={[styles.chip, editBedId === null && styles.chipOn]}
                  onPress={() => setEditBedId(null)}
                >
                  <Text style={[styles.chipTxt, editBedId === null && styles.chipTxtOn]}>None</Text>
                </Pressable>
                {beds.map(b => (
                  <Pressable
                    key={b.id}
                    style={[styles.chip, editBedId === b.id && styles.chipOn]}
                    onPress={() => setEditBedId(b.id)}
                  >
                    <Text style={[styles.chipTxt, editBedId === b.id && styles.chipTxtOn]}>{b.name}</Text>
                  </Pressable>
                ))}
              </View>
              {editBedId != null && (
                <Pressable
                  style={styles.openBedBtn}
                  onPress={() => {
                    setEditShape(null);
                    router.push({ pathname: '/bed/[id]', params: { id: editBedId! } });
                  }}
                >
                  <Text style={styles.openBedTxt}>Open Bed Page →</Text>
                </Pressable>
              )}
              <View style={styles.modalBtns}>
                <Pressable style={styles.btnDelete} onPress={handleDeleteShape}>
                  <Text style={styles.btnDeleteTxt}>Delete</Text>
                </Pressable>
                <Pressable style={styles.btnCancel} onPress={() => setEditShape(null)}>
                  <Text style={styles.btnCancelTxt}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.btnSave} onPress={handleSaveEdit}>
                  <Text style={styles.btnSaveTxt}>Save</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Canvas Size Modal ── */}
      <Modal visible={canvasVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modal, styles.modalPadded]}>
            <Text style={styles.modalTitle}>Canvas Size</Text>
            <Text style={styles.sublbl}>Set the real-world dimensions of this garden area.</Text>
            <Text style={styles.lbl}>Width (ft)</Text>
            <TextInput
              style={styles.input}
              value={canvasWIn}
              onChangeText={setCanvasWIn}
              keyboardType="decimal-pad"
              placeholder="20"
              placeholderTextColor="#aaa"
            />
            <Text style={styles.lbl}>Height (ft)</Text>
            <TextInput
              style={styles.input}
              value={canvasHIn}
              onChangeText={setCanvasHIn}
              keyboardType="decimal-pad"
              placeholder="15"
              placeholderTextColor="#aaa"
            />
            <View style={styles.modalBtns}>
              <Pressable style={styles.btnCancel} onPress={() => setCanvasVisible(false)}>
                <Text style={styles.btnCancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnSave} onPress={handleSaveCanvas}>
                <Text style={styles.btnSaveTxt}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </RNAnimated.View>
  );
}

const lc = StyleSheet.create({
  card: {
    backgroundColor: '#FEFAF4',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#8B5A2B',
    shadowColor: '#2d1200',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 1,
    overflow: 'hidden',
  },
  cardLifted: {
    zIndex: 999,
    elevation: 16,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    borderColor: '#5C3010',
  },
  plankTop: {
    height: 16,
    backgroundColor: '#8B5A2B',
    borderBottomWidth: 1.5,
    borderBottomColor: '#5C3010',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  plankBottom: {
    height: 11,
    backgroundColor: '#7A4F22',
    borderTopWidth: 1,
    borderTopColor: '#5C3010',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  woodGrain: {
    position: 'absolute',
    width: '15%',
    height: 1.5,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 2,
  },
  woodKnot: {
    position: 'absolute',
    left: '8%',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: CARD_HEADER_H,
    paddingHorizontal: 8,
    gap: 2,
    backgroundColor: '#FEFAF4',
  },
  dragHandle: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragIcon: { fontSize: 20, color: '#9B7040', lineHeight: 22 },
  titleArea: { flex: 1, paddingHorizontal: 4 },
  title: { fontSize: 17, fontWeight: '700', color: '#5C3010' },
  renameInput: {
    fontSize: 17,
    fontWeight: '700',
    color: '#5C3010',
    borderBottomWidth: 1.5,
    borderBottomColor: '#8B5A2B',
    paddingVertical: 2,
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { fontSize: 16, color: '#8B5A2B' },
  chevronBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  chevron: { fontSize: 13, color: '#9B7040' },
  body: { paddingHorizontal: 14, paddingBottom: 16, alignItems: 'center', backgroundColor: '#FEFAF4' },
  canvasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  canvasInfo: { fontSize: 11, color: '#8B6540', flex: 1 },
  canvasBtn: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 7, backgroundColor: '#f5ede0',
    borderWidth: 1, borderColor: '#C8956C',
  },
  canvasBtnText: { fontSize: 12, color: '#7A4F22' },
  canvas: {
    backgroundColor: '#e8f5e9',
    borderWidth: 2, borderColor: '#6B8B5A',
    borderRadius: 4, overflow: 'hidden',
    shadowColor: '#1a4a22', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  canvasEmpty: {
    position: 'absolute', top: '40%', left: 0, right: 0,
    fontSize: 13, color: '#bbb', textAlign: 'center', paddingHorizontal: 20,
  },
  addBtn: {
    marginTop: 12, paddingVertical: 12,
    borderRadius: 10, borderWidth: 1.5, borderColor: '#8B5A2B',
    alignItems: 'center', backgroundColor: 'rgba(254,250,244,0.95)',
  },
  addBtnText: { color: '#7A4F22', fontWeight: '600', fontSize: 14 },
});

// ── Main Layouts Screen ────────────────────────────────────────────────────────

// Persists across screen unmount/remount within the same app session
let savedExpandedIds: Set<number> | null = null;

export default function LayoutsScreen() {
  const { userId } = useAuth();
  const router = useRouter();

  const [layouts, setLayouts] = useState<GardenLayout[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => savedExpandedIds ?? new Set());
  const [beds, setBeds] = useState<GardenBed[]>([]);
  const [plantCounts, setPlantCounts] = useState<Record<number, number>>({});

  const layoutsRef = useRef(layouts);
  layoutsRef.current = layouts;

  useEffect(() => {
    if (userId) loadAll();
  }, [userId]);

  useEffect(() => {
    savedExpandedIds = expandedIds;
  }, [expandedIds]);

  function loadAll() {
    getOrCreateDefaultLayout(userId!);
    const ls = getLayouts(userId!);
    setLayouts(ls);
    if (ls.length > 0 && savedExpandedIds === null) {
      setExpandedIds(new Set([ls[0].id]));
    }
    const b = getGardenBeds(userId!);
    setBeds(b);
    const counts: Record<number, number> = {};
    for (const bed of b) counts[bed.id] = getPlants(bed.id).length;
    setPlantCounts(counts);
  }

  function toggleExpanded(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleRename(id: number, name: string) {
    renameLayout(id, name);
    setLayouts(prev => prev.map(l => l.id === id ? { ...l, name } : l));
  }

  function handleDelete(id: number) {
    deleteLayout(id);
    setExpandedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    const ls = getLayouts(userId!);
    setLayouts(ls);
  }

  function handleAddLayout() {
    const newLayout = createLayout(userId!, 'New Layout');
    setLayouts(getLayouts(userId!));
    setExpandedIds(prev => new Set([...prev, newLayout.id]));
  }

  function handleReorder(fromIdx: number, toIdx: number) {
    setLayouts(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      reorderLayouts(arr.map((l, i) => ({ id: l.id, sort_order: i })));
      return arr;
    });
  }

  function handleReorderEnd() {
    // DB is saved inside handleReorder's setLayouts updater
  }

  return (
    <GardenBackground style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>My Layouts</Text>
          <Pressable style={styles.addLayoutBtn} onPress={handleAddLayout}>
            <Text style={styles.addLayoutTxt}>+ New Layout</Text>
          </Pressable>
        </View>

        {layouts.length === 0 && (
          <Text style={styles.empty}>No layouts yet.{'\n'}Tap "+ New Layout" to get started.</Text>
        )}

        {layouts.map((layout, index) => (
          <LayoutCard
            key={layout.id}
            layout={layout}
            isExpanded={expandedIds.has(layout.id)}
            onToggle={() => toggleExpanded(layout.id)}
            onRename={(name) => handleRename(layout.id, name)}
            onDelete={() => handleDelete(layout.id)}
            index={index}
            total={layouts.length}
            onReorder={handleReorder}
            onReorderEnd={handleReorderEnd}
            userId={userId!}
            beds={beds}
            plantCounts={plantCounts}
            router={router}
          />
        ))}
      </ScrollView>
    </GardenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: H_PAD, paddingBottom: 40, overflow: 'visible' },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pageTitle: { fontSize: 26, fontWeight: '700', color: '#3a7d44' },
  addLayoutBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#3a7d44',
  },
  addLayoutTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },

  empty: {
    textAlign: 'center', color: '#888',
    marginTop: 60, lineHeight: 24, fontSize: 16,
  },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center' },
  overlayScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalPadded: { marginHorizontal: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#11181C', marginBottom: 8 },
  lbl: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 12 },
  sublbl: { fontSize: 12, color: '#999', marginBottom: 2 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: '#11181C', backgroundColor: '#fff',
  },

  typeRow: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 4 },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#ddd', alignItems: 'center',
  },
  typeBtnOn: { borderColor: '#3a7d44', backgroundColor: '#eaf4eb' },
  typeTxt: { fontSize: 13, color: '#888', fontWeight: '500' },
  typeTxtOn: { color: '#3a7d44', fontWeight: '700' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: {
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 16, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f5f5f5',
  },
  chipOn: { borderColor: '#3a7d44', backgroundColor: '#eaf4eb' },
  chipTxt: { fontSize: 13, color: '#666' },
  chipTxtOn: { color: '#3a7d44', fontWeight: '600' },

  openBedBtn: {
    marginTop: 12, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#3a7d44', alignItems: 'center',
  },
  openBedTxt: { color: '#3a7d44', fontWeight: '600', fontSize: 14 },

  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btnCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#ccc',
  },
  btnCancelTxt: { color: '#444', fontWeight: '500' },
  btnSave: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#3a7d44',
  },
  btnSaveTxt: { color: '#fff', fontWeight: '700' },
  btnDelete: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#c0392b',
  },
  btnDeleteTxt: { color: '#fff', fontWeight: '700' },
});
