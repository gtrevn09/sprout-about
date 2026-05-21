import { GardenBackground } from '@/components/garden-background';
import { ThemedText } from '@/components/themed-text';
import { EmojiPicker } from '@/components/emoji-picker';
import { addPlant, deletePlant, GardenBed, getGardenBed, getPlants, Plant } from '@/lib/database';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function BedDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bedId = Number(id);
  const router = useRouter();

  const [bed, setBed] = useState<GardenBed | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPlantName, setNewPlantName] = useState('');
  const [newPlantQty, setNewPlantQty] = useState('1');
  const [newPlantEmoji, setNewPlantEmoji] = useState<string | null>(null);

  useEffect(() => {
    setBed(getGardenBed(bedId));
  }, [bedId]);

  useFocusEffect(
    useCallback(() => {
      setPlants(getPlants(bedId));
    }, [bedId])
  );

  function handleAddPlant() {
    if (!newPlantName.trim()) return;
    const qty = Math.max(1, parseInt(newPlantQty, 10) || 1);
    addPlant(bedId, newPlantName.trim(), qty, newPlantEmoji);
    setPlants(getPlants(bedId));
    setNewPlantName('');
    setNewPlantQty('1');
    setNewPlantEmoji(null);
    setModalVisible(false);
  }

  function handleDeletePlant(plantId: number) {
    Alert.alert('Remove Plant', 'Remove this plant and all its data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          deletePlant(plantId);
          setPlants(getPlants(bedId));
        },
      },
    ]);
  }

  return (
    <GardenBackground style={styles.container}>
      <Stack.Screen options={{ title: bed?.name ?? 'Garden Bed' }} />
      <FlatList
        data={plants}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          plants.length > 0 ? (
            <ThemedText style={styles.hint}>Tap a plant to view details. Hold to remove.</ThemedText>
          ) : null
        }
        ListEmptyComponent={
          <ThemedText style={styles.empty}>
            No plants yet.{'\n'}Tap + to add your first plant.
          </ThemedText>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/plant/[id]', params: { id: item.id } })}
            onLongPress={() => handleDeletePlant(item.id)}
          >
            <PlantCard plant={item} />
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <ThemedText style={styles.fabText}>+</ThemedText>
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScroll}>
            <View style={styles.modal}>
              <ThemedText type="subtitle" style={styles.modalTitle}>Add Plant</ThemedText>

              <TextInput
                style={styles.input}
                placeholder="e.g., Tomatoes, Basil, Zucchini"
                placeholderTextColor="#888"
                value={newPlantName}
                onChangeText={setNewPlantName}
                autoFocus
              />

              <ThemedText style={styles.qtyLabel}>How many in this bed?</ThemedText>
              <TextInput
                style={[styles.input, styles.qtyInput]}
                placeholder="1"
                placeholderTextColor="#888"
                value={newPlantQty}
                onChangeText={setNewPlantQty}
                keyboardType="number-pad"
              />

              <ThemedText style={styles.qtyLabel}>Plant Icon (optional)</ThemedText>
              <EmojiPicker value={newPlantEmoji} onChange={setNewPlantEmoji} />

              <View style={styles.modalBtns}>
                <Pressable
                  style={styles.btnCancel}
                  onPress={() => {
                    setModalVisible(false);
                    setNewPlantName('');
                    setNewPlantQty('1');
                    setNewPlantEmoji(null);
                  }}
                >
                  <ThemedText style={styles.btnCancelText}>Cancel</ThemedText>
                </Pressable>
                <Pressable style={styles.btnAdd} onPress={handleAddPlant}>
                  <ThemedText style={styles.btnAddText}>Add</ThemedText>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </GardenBackground>
  );
}

// ── Plant Card ─────────────────────────────────────────────────────────────────

function PlantCard({ plant }: { plant: Plant }) {
  const hasEmoji = !!plant.emoji;

  return (
    <View style={pc.card}>
      {/* Vine header strip */}
      <View style={pc.vineStrip}>
        <Text style={pc.vineLeaf}>🌿</Text>
        <View style={pc.vineStem} />
        <Text style={pc.vineLeaf}>🍃</Text>
        <View style={pc.vineStem} />
        <Text style={pc.vineLeaf}>🌿</Text>
        <View style={pc.vineStem} />
        <Text style={pc.vineLeaf}>🍃</Text>
        <View style={pc.vineStem} />
        <Text style={pc.vineLeaf}>🌿</Text>
      </View>

      {/* Content row */}
      <View style={pc.row}>
        {/* Left accent bar */}
        <View style={pc.accent} />

        {/* Emoji badge */}
        <View style={[pc.emojiBadge, !hasEmoji && pc.emojiBadgeEmpty]}>
          <Text style={pc.emojiText}>{plant.emoji ?? '🌱'}</Text>
        </View>

        {/* Info */}
        <View style={pc.info}>
          <View style={pc.nameRow}>
            <Text style={pc.name} numberOfLines={1}>{plant.name}</Text>
            {plant.quantity > 1 && (
              <View style={pc.qtyBadge}>
                <Text style={pc.qtyText}>×{plant.quantity}</Text>
              </View>
            )}
          </View>
          <Text style={pc.sub}>
            {plant.planted_date ? `Planted ${plant.planted_date}` : 'Tap to add details'}
          </Text>
        </View>

        {/* Chevron */}
        <Text style={pc.chevron}>›</Text>
      </View>
    </View>
  );
}

const pc = StyleSheet.create({
  card: {
    backgroundColor: '#f4faf4',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#3a7d44',
    overflow: 'hidden',
    shadowColor: '#1a4a22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  vineStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d7eedb',
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  vineLeaf: { fontSize: 13 },
  vineStem: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#6abf69',
    marginHorizontal: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accent: {
    width: 5,
    alignSelf: 'stretch',
    backgroundColor: '#3a7d44',
  },
  emojiBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#e0f2e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#a5d6a7',
  },
  emojiBadgeEmpty: {
    backgroundColor: '#f0f7f0',
    borderColor: '#c8e6c9',
  },
  emojiText: { fontSize: 26 },
  info: { flex: 1, paddingVertical: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '700', color: '#2e5c35', flexShrink: 1 },
  qtyBadge: {
    backgroundColor: '#3a7d44',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  qtyText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sub: { fontSize: 12, color: '#777', marginTop: 3 },
  chevron: { fontSize: 22, color: '#aaa', paddingHorizontal: 14 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 20, paddingBottom: 100 },
  hint: { color: '#888', fontSize: 13, marginBottom: 12 },
  empty: {
    textAlign: 'center',
    color: '#888',
    marginTop: 60,
    lineHeight: 24,
    fontSize: 16,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#3a7d44',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 36, fontWeight: '300' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  modalTitle: { marginBottom: 16, fontSize: 18 },
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
  qtyLabel: { fontSize: 14, color: '#555', marginBottom: 6, marginTop: 4 },
  qtyInput: { marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 20 },
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
