import { GardenBackground } from '@/components/garden-background';
import { ThemedText } from '@/components/themed-text';
import { addPlant, deletePlant, GardenBed, getGardenBed, getPlants, Plant } from '@/lib/database';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

export default function BedDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bedId = Number(id);
  const router = useRouter();
  const navigation = useNavigation();

  const [bed, setBed] = useState<GardenBed | null>(null);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPlantName, setNewPlantName] = useState('');

  useEffect(() => {
    const found = getGardenBed(bedId);
    setBed(found);
    if (found) navigation.setOptions({ title: found.name });
  }, [bedId]);

  useFocusEffect(
    useCallback(() => {
      setPlants(getPlants(bedId));
    }, [bedId])
  );

  function handleAddPlant() {
    if (!newPlantName.trim()) return;
    addPlant(bedId, newPlantName.trim());
    setPlants(getPlants(bedId));
    setNewPlantName('');
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
            style={styles.plantCard}
            onPress={() => router.push({ pathname: '/plant/[id]', params: { id: item.id } })}
            onLongPress={() => handleDeletePlant(item.id)}
          >
            <ThemedText style={styles.plantName}>{item.name}</ThemedText>
            {item.planted_date ? (
              <ThemedText style={styles.plantSub}>Planted: {item.planted_date}</ThemedText>
            ) : (
              <ThemedText style={styles.plantSub}>Tap to add details</ThemedText>
            )}
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <ThemedText style={styles.fabText}>+</ThemedText>
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
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
            <View style={styles.modalBtns}>
              <Pressable
                style={styles.btnCancel}
                onPress={() => { setModalVisible(false); setNewPlantName(''); }}
              >
                <ThemedText style={styles.btnCancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable style={styles.btnAdd} onPress={handleAddPlant}>
                <ThemedText style={styles.btnAddText}>Add</ThemedText>
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
  list: { padding: 20, paddingBottom: 100 },
  hint: { color: '#888', fontSize: 13, marginBottom: 12 },
  empty: {
    textAlign: 'center',
    color: '#888',
    marginTop: 60,
    lineHeight: 24,
    fontSize: 16,
  },
  plantCard: {
    backgroundColor: '#f0f7f0',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  plantName: { fontSize: 17, fontWeight: '600', color: '#2e5c35' },
  plantSub: { fontSize: 13, color: '#666', marginTop: 4 },
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
    paddingHorizontal: 32,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
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
