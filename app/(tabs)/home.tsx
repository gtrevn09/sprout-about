import { useAuth } from '@/context/auth';
import { GardenBackground } from '@/components/garden-background';
import { ThemedText } from '@/components/themed-text';
import { addGardenBed, deleteGardenBed, GardenBed, getGardenBeds, renameGardenBed } from '@/lib/database';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

// ── Garden Bed Card ────────────────────────────────────────────────────────────

function GardenBedCard({
  bed,
  onPress,
  onLongPress,
}: {
  bed: GardenBed;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={bed_s.outerFrame}>
      {/* Top plank */}
      <View style={bed_s.plankH}>
        <View style={bed_s.knot} />
        <View style={[bed_s.grain, { left: '30%' }]} />
        <View style={[bed_s.grain, { left: '65%' }]} />
      </View>
      {/* Middle: left plank | dirt | right plank */}
      <View style={bed_s.middle}>
        <View style={bed_s.plankV} />
        <View style={bed_s.dirtArea}>
          {/* Soil texture dots */}
          <View style={bed_s.soilRow}>
            {[...Array(8)].map((_, i) => <View key={i} style={bed_s.soilDot} />)}
          </View>
          <Text style={bed_s.bedName}>{bed.name}</Text>
          <Text style={bed_s.bedHint}>Tap to view · Hold to edit</Text>
          <View style={[bed_s.soilRow, { marginTop: 6 }]}>
            {[...Array(8)].map((_, i) => <View key={i} style={[bed_s.soilDot, { opacity: 0.4 }]} />)}
          </View>
        </View>
        <View style={bed_s.plankV} />
      </View>
      {/* Bottom plank */}
      <View style={bed_s.plankH}>
        <View style={[bed_s.grain, { left: '20%' }]} />
        <View style={[bed_s.grain, { left: '55%' }]} />
        <View style={[bed_s.grain, { left: '80%' }]} />
      </View>
    </Pressable>
  );
}

const bed_s = StyleSheet.create({
  outerFrame: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#2d1200',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  plankH: {
    height: 18,
    backgroundColor: '#8B5A2B',
    borderTopColor: '#A0682E',
    borderBottomColor: '#6B3E18',
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  plankV: {
    width: 18,
    backgroundColor: '#7A4F22',
    borderLeftColor: '#9B6030',
    borderRightColor: '#5C3010',
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  // Faux wood-grain horizontal line
  grain: {
    position: 'absolute',
    width: '18%',
    height: 1.5,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 2,
  },
  // Small wood knot circle
  knot: {
    position: 'absolute',
    left: '12%',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  middle: {
    flexDirection: 'row',
    backgroundColor: '#3D2008',
  },
  dirtArea: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#3D2008',
  },
  soilRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 4,
    justifyContent: 'center',
  },
  soilDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#6B4020',
  },
  bedName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F5D9A0',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bedHint: {
    fontSize: 11,
    color: '#A07848',
    textAlign: 'center',
    marginTop: 3,
  },
});

// ── Home Screen ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { userId, logout } = useAuth();
  const router = useRouter();
  const isNavigating = useRef(false);
  const [beds, setBeds] = useState<GardenBed[]>([]);
  const [bedsExpanded, setBedsExpanded] = useState(true);

  const [addVisible, setAddVisible] = useState(false);
  const [newBedName, setNewBedName] = useState('');
  const [renameVisible, setRenameVisible] = useState(false);
  const [renamingBed, setRenamingBed] = useState<GardenBed | null>(null);
  const [renameText, setRenameText] = useState('');

  useFocusEffect(
    useCallback(() => {
      isNavigating.current = false;
      if (userId) setBeds(getGardenBeds(userId));
    }, [userId])
  );

  function handleAddBed() {
    if (!newBedName.trim() || !userId) return;
    addGardenBed(userId, newBedName.trim());
    setBeds(getGardenBeds(userId));
    setNewBedName('');
    setAddVisible(false);
  }

  function handleLongPress(bed: GardenBed) {
    Alert.alert(bed.name, 'What would you like to do?', [
      {
        text: 'Edit Name',
        onPress: () => {
          setRenamingBed(bed);
          setRenameText(bed.name);
          setRenameVisible(true);
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Delete Bed', 'This will also remove all plants inside it. Continue?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                deleteGardenBed(bed.id);
                if (userId) setBeds(getGardenBeds(userId));
              },
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleRename() {
    if (!renameText.trim() || !renamingBed) return;
    renameGardenBed(renamingBed.id, renameText.trim());
    if (userId) setBeds(getGardenBeds(userId));
    setRenameVisible(false);
    setRenamingBed(null);
    setRenameText('');
  }

  async function handleLogout() {
    await logout();
    router.replace('/');
  }

  return (
    <GardenBackground style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={{ color: '#3a7d44' }}>My Garden</ThemedText>
          <Pressable onPress={handleLogout} style={styles.logoutBtn}>
            <ThemedText style={styles.logoutText}>Log Out</ThemedText>
          </Pressable>
        </View>

        {/* My Layouts section */}
        <Pressable style={styles.sectionCard} onPress={() => {
          if (isNavigating.current) return;
          isNavigating.current = true;
          router.push('/layout');
        }}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionIcon}>🗺️</Text>
            <View style={styles.sectionText}>
              <Text style={styles.sectionTitle}>My Layouts</Text>
              <Text style={styles.sectionSub}>Visualize and arrange your garden space</Text>
            </View>
            <Text style={styles.sectionChevron}>›</Text>
          </View>
        </Pressable>

        {/* My Garden Beds accordion */}
        <View style={styles.accordionCard}>
          <Pressable
            style={styles.accordionHeader}
            onPress={() => setBedsExpanded(v => !v)}
          >
            <Text style={styles.sectionIcon}>🌱</Text>
            <View style={styles.sectionText}>
              <Text style={styles.sectionTitle}>My Garden Beds</Text>
              <Text style={styles.sectionSub}>
                {beds.length === 0
                  ? 'No beds yet — tap + to add one'
                  : `${beds.length} bed${beds.length !== 1 ? 's' : ''}`}
              </Text>
            </View>
            <Text style={styles.sectionChevron}>{bedsExpanded ? '▲' : '▼'}</Text>
          </Pressable>

          {bedsExpanded && (
            <View style={styles.accordionBody}>
              {beds.length === 0 ? (
                <Text style={styles.emptyBeds}>
                  Tap the + button to add your first garden bed.
                </Text>
              ) : (
                beds.map(bed => (
                  <GardenBedCard
                    key={bed.id}
                    bed={bed}
                    onPress={() => {
                      if (isNavigating.current) return;
                      isNavigating.current = true;
                      router.push({ pathname: '/bed/[id]', params: { id: bed.id } });
                    }}
                    onLongPress={() => handleLongPress(bed)}
                  />
                ))
              )}

              <Pressable style={styles.addBedBtn} onPress={() => setAddVisible(true)}>
                <Text style={styles.addBedBtnText}>+ Add Garden Bed</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add bed modal */}
      <Modal visible={addVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <ThemedText type="subtitle" style={styles.modalTitle}>New Garden Bed</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="e.g., Raised Bed 1, Front Yard"
              placeholderTextColor="#888"
              value={newBedName}
              onChangeText={setNewBedName}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <Pressable
                style={styles.btnCancel}
                onPress={() => { setAddVisible(false); setNewBedName(''); }}
              >
                <ThemedText style={styles.btnCancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable style={styles.btnAdd} onPress={handleAddBed}>
                <ThemedText style={styles.btnAddText}>Add</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename bed modal */}
      <Modal visible={renameVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitleDark}>Rename Bed</Text>
            <TextInput
              style={styles.input}
              placeholder="New name"
              placeholderTextColor="#888"
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalBtns}>
              <Pressable
                style={styles.btnCancel}
                onPress={() => { setRenameVisible(false); setRenamingBed(null); setRenameText(''); }}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnAdd} onPress={handleRename}>
                <Text style={styles.btnAddText}>Save</Text>
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
  scroll: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoutBtn: { padding: 8 },
  logoutText: { color: '#3a7d44', fontSize: 15 },

  // ── Section card (My Layouts nav) ──
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#3a7d44',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  sectionIcon: { fontSize: 26 },
  sectionText: { flex: 1 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#2e5c35' },
  sectionSub: { fontSize: 12, color: '#888', marginTop: 2 },
  sectionChevron: { fontSize: 22, color: '#3a7d44', fontWeight: '300' },

  // ── Accordion (My Garden Beds) ──
  accordionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#c8e6c9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  accordionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    paddingTop: 14,
  },
  emptyBeds: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 20,
  },
  addBedBtn: {
    borderWidth: 1.5,
    borderColor: '#3a7d44',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(58,125,68,0.06)',
  },
  addBedBtnText: { color: '#3a7d44', fontWeight: '600', fontSize: 15 },

  // ── Modals ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  modalTitle: { marginBottom: 16, fontSize: 18 },
  modalTitleDark: { fontSize: 18, fontWeight: '700', color: '#11181C', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#11181C',
    marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  btnCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  btnCancelText: { color: '#444', fontWeight: '500' },
  btnAdd: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#3a7d44',
  },
  btnAddText: { color: '#fff', fontWeight: '700' },
});
