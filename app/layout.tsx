import { GardenBackground } from '@/components/garden-background';
import { useAuth } from '@/context/auth';
import {
  addLayoutShape,
  deleteLayoutShape,
  GardenBed,
  getGardenBeds,
  getLayoutShapes,
  getOrCreateLayout,
  getPlants,
  LayoutShape,
  updateLayoutCanvas,
  updateLayoutShape,
  updateShapeTransform,
} from '@/lib/database';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
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
const CANVAS_MAX_H = SCREEN_H - 280;

const SHAPE_COLORS = [
  '#c8e6c9', '#a5d6a7', '#d7ccc8', '#b3e5fc',
  '#fff9c4', '#ffe0b2', '#e1bee7',
];

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ── DraggableShape ─────────────────────────────────────────────────────────────

type DSProps = {
  shape: LayoutShape;
  scale: number;
  canvasWFt: number;
  canvasHFt: number;
  plantCount: number;
  linkedBedName: string | null;
  onTap: () => void;
  onTransformSave: (id: number, x: number, y: number, rotation: number) => void;
};

function DraggableShape({
  shape, scale, canvasWFt, canvasHFt,
  plantCount, linkedBedName, onTap, onTransformSave,
}: DSProps) {
  const posX = useSharedValue(shape.x * scale);
  const posY = useSharedValue(shape.y * scale);
  const rotation = useSharedValue(shape.rotation);
  const savedX = useSharedValue(shape.x * scale);
  const savedY = useSharedValue(shape.y * scale);
  const savedRot = useSharedValue(shape.rotation);

  useEffect(() => {
    posX.value = shape.x * scale;
    posY.value = shape.y * scale;
    rotation.value = shape.rotation;
    savedX.value = shape.x * scale;
    savedY.value = shape.y * scale;
    savedRot.value = shape.rotation;
  }, [shape.x, shape.y, shape.rotation, scale]);

  // runOnJS(true): Reanimated v4 + RNGH v2 worklet compilation is unreliable; JS-thread callbacks with shared value writes are synchronous on new arch
  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {
      savedX.value = posX.value;
      savedY.value = posY.value;
    })
    .onUpdate((e) => {
      posX.value = clamp(savedX.value + e.translationX, 0, (canvasWFt - shape.width_ft) * scale);
      posY.value = clamp(savedY.value + e.translationY, 0, (canvasHFt - shape.height_ft) * scale);
    })
    .onEnd((e) => {
      const dist = Math.sqrt(e.translationX * e.translationX + e.translationY * e.translationY);
      const rotDiff = Math.abs(rotation.value - savedRot.value);
      if (dist < 8 && rotDiff < 0.1) {
        posX.value = savedX.value;
        posY.value = savedY.value;
        onTap();
      } else {
        onTransformSave(shape.id, posX.value / scale, posY.value / scale, rotation.value);
      }
    });

  const rotGesture = Gesture.Rotation()
    .runOnJS(true)
    .onBegin(() => {
      savedRot.value = rotation.value;
    })
    .onUpdate((e) => {
      rotation.value = savedRot.value + e.rotation;
    })
    .onEnd(() => {
      onTransformSave(shape.id, posX.value / scale, posY.value / scale, rotation.value);
    });

  const composed = Gesture.Simultaneous(panGesture, rotGesture);

  const animStyle = useAnimatedStyle(() => ({
    left: posX.value,
    top: posY.value,
    transform: [{ rotate: `${rotation.value}rad` }],
  }));

  const pxW = shape.width_ft * scale;
  const pxH = shape.height_ft * scale;
  const isCircle = shape.shape_type === 'circle';

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          ss.shape,
          {
            width: pxW,
            height: pxH,
            backgroundColor: shape.color,
            borderRadius: isCircle ? pxW / 2 : 6,
          },
          animStyle,
        ]}
      >
        {shape.label ? (
          <Text style={ss.label} numberOfLines={2} adjustsFontSizeToFit>{shape.label}</Text>
        ) : null}
        <Text style={ss.dims}>{shape.width_ft}×{shape.height_ft}ft</Text>
        {linkedBedName ? (
          <Text style={ss.bedLink} numberOfLines={1}>🌱 {linkedBedName}</Text>
        ) : null}
        {plantCount > 0 ? (
          <View style={ss.badge}><Text style={ss.badgeText}>{plantCount}</Text></View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

const ss = StyleSheet.create({
  shape: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.18)',
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

// ── Main screen ────────────────────────────────────────────────────────────────

export default function LayoutScreen() {
  const { userId } = useAuth();
  const router = useRouter();

  const [layout, setLayout] = useState({ canvas_width_ft: 20, canvas_height_ft: 15 });
  const [shapes, setShapes] = useState<LayoutShape[]>([]);
  const [beds, setBeds] = useState<GardenBed[]>([]);
  const [plantCounts, setPlantCounts] = useState<Record<number, number>>({});

  // Add modal
  const [addVisible, setAddVisible] = useState(false);
  const [addType, setAddType] = useState<'rectangle' | 'circle'>('rectangle');
  const [addLabel, setAddLabel] = useState('');
  const [addW, setAddW] = useState('4');
  const [addH, setAddH] = useState('4');
  const [addColor, setAddColor] = useState(SHAPE_COLORS[0]);

  // Edit modal
  const [editShape, setEditShape] = useState<LayoutShape | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editW, setEditW] = useState('');
  const [editH, setEditH] = useState('');
  const [editColor, setEditColor] = useState(SHAPE_COLORS[0]);
  const [editBedId, setEditBedId] = useState<number | null>(null);

  // Canvas size modal
  const [canvasVisible, setCanvasVisible] = useState(false);
  const [canvasWIn, setCanvasWIn] = useState('');
  const [canvasHIn, setCanvasHIn] = useState('');

  useEffect(() => { if (userId) loadData(); }, [userId]);

  function loadData() {
    const l = getOrCreateLayout(userId!);
    setLayout({ canvas_width_ft: l.canvas_width_ft, canvas_height_ft: l.canvas_height_ft });
    setShapes(getLayoutShapes(userId!));
    const b = getGardenBeds(userId!);
    setBeds(b);
    const counts: Record<number, number> = {};
    for (const bed of b) counts[bed.id] = getPlants(bed.id).length;
    setPlantCounts(counts);
  }

  // ── Add ──────────────────────────────────────────────────────────────────────

  function handleAddShape() {
    const w = Math.max(0.5, parseFloat(addW) || 4);
    const h = addType === 'circle' ? w : Math.max(0.5, parseFloat(addH) || 4);
    addLayoutShape(userId!, addType, 0, 0, w, h, addLabel.trim() || null, addColor);
    setShapes(getLayoutShapes(userId!));
    setAddVisible(false);
    resetAddForm();
  }

  function resetAddForm() {
    setAddLabel(''); setAddW('4'); setAddH('4');
    setAddType('rectangle'); setAddColor(SHAPE_COLORS[0]);
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────

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
    setShapes(getLayoutShapes(userId!));
    setEditShape(null);
  }

  function handleDeleteShape() {
    if (!editShape) return;
    Alert.alert('Delete Shape', 'Remove this shape from the layout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        deleteLayoutShape(editShape.id);
        setShapes(getLayoutShapes(userId!));
        setEditShape(null);
      }},
    ]);
  }

  // ── Canvas ───────────────────────────────────────────────────────────────────

  function handleSaveCanvas() {
    const w = Math.max(1, parseFloat(canvasWIn) || layout.canvas_width_ft);
    const h = Math.max(1, parseFloat(canvasHIn) || layout.canvas_height_ft);
    updateLayoutCanvas(userId!, w, h);
    setLayout({ canvas_width_ft: w, canvas_height_ft: h });
    setCanvasVisible(false);
  }

  function handleTransformSave(id: number, x: number, y: number, rotation: number) {
    updateShapeTransform(id, x, y, rotation);
    setShapes(prev => prev.map(s => s.id === id ? { ...s, x, y, rotation } : s));
  }

  // ── Canvas sizing: fit both dimensions on screen ──────────────────────────────

  const scaleByW = CANVAS_MAX_W / layout.canvas_width_ft;
  const scaleByH = CANVAS_MAX_H / layout.canvas_height_ft;
  const scale = Math.min(scaleByW, scaleByH);
  const canvasPxW = Math.round(layout.canvas_width_ft * scale);
  const canvasPxH = Math.round(layout.canvas_height_ft * scale);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <GardenBackground style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.title}>My Layout</Text>
          <Pressable
            style={styles.canvasBtn}
            onPress={() => {
              setCanvasWIn(String(layout.canvas_width_ft));
              setCanvasHIn(String(layout.canvas_height_ft));
              setCanvasVisible(true);
            }}
          >
            <Text style={styles.canvasBtnText}>⚙ Canvas Size</Text>
          </Pressable>
        </View>

        <Text style={styles.canvasInfo}>
          {layout.canvas_width_ft}ft × {layout.canvas_height_ft}ft  ·  tap to edit  ·  drag to move  ·  two fingers to rotate
        </Text>

        <View style={[styles.canvas, { width: canvasPxW, height: canvasPxH }]}>
          {shapes.length === 0 && (
            <Text style={styles.canvasEmpty}>Tap "+ Add Shape" to place your first garden bed</Text>
          )}
          {shapes.map(shape => (
            <DraggableShape
              key={shape.id}
              shape={shape}
              scale={scale}
              canvasWFt={layout.canvas_width_ft}
              canvasHFt={layout.canvas_height_ft}
              plantCount={shape.bed_id ? (plantCounts[shape.bed_id] ?? 0) : 0}
              linkedBedName={shape.bed_id ? (beds.find(b => b.id === shape.bed_id)?.name ?? null) : null}
              onTap={() => openEdit(shape)}
              onTransformSave={handleTransformSave}
            />
          ))}
        </View>

        <Pressable style={[styles.addBtn, { width: canvasPxW }]} onPress={() => setAddVisible(true)}>
          <Text style={styles.addBtnText}>+ Add Shape</Text>
        </Pressable>
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
            <Text style={styles.sublbl}>Set the real-world dimensions of your garden area.</Text>
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
    </GardenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: H_PAD,
    paddingBottom: 20,
  },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', width: '100%', marginBottom: 4,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#3a7d44' },
  canvasBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1, borderColor: '#ccc',
  },
  canvasBtnText: { fontSize: 13, color: '#555' },
  canvasInfo: { fontSize: 12, color: '#555', marginBottom: 10, alignSelf: 'flex-start' },

  canvas: {
    backgroundColor: '#fff',
    borderWidth: 1.5, borderColor: '#bbb',
    borderRadius: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 4,
  },
  canvasEmpty: {
    position: 'absolute', top: '40%', left: 0, right: 0,
    fontSize: 14, color: '#bbb', textAlign: 'center', paddingHorizontal: 20,
  },

  addBtn: {
    marginTop: 14, paddingVertical: 13,
    borderRadius: 10, borderWidth: 1.5, borderColor: '#3a7d44',
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)',
  },
  addBtnText: { color: '#3a7d44', fontWeight: '600', fontSize: 15 },

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
