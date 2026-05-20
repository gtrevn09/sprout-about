import { useAuth } from '@/context/auth';
import { GardenBackground } from '@/components/garden-background';
import { ThemedText } from '@/components/themed-text';
import { addGardenBed, deleteGardenBed, GardenBed, getGardenBeds } from '@/lib/database';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

export default function HomeScreen() {
  const { userId, logout } = useAuth();
  const router = useRouter();
  const [beds, setBeds] = useState<GardenBed[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newBedName, setNewBedName] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (userId) setBeds(getGardenBeds(userId));
    }, [userId])
  );

  function handleAddBed() {
    if (!newBedName.trim() || !userId) return;
    addGardenBed(userId, newBedName.trim());
    setBeds(getGardenBeds(userId));
    setNewBedName('');
    setModalVisible(false);
  }

  function handleDeleteBed(id: number) {
    Alert.alert('Delete Bed', 'This will also remove all plants inside it. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteGardenBed(id);
          if (userId) setBeds(getGardenBeds(userId));
        },
      },
    ]);
  }

  async function handleLogout() {
    await logout();
    router.replace('/');
  }

  return (
    <GardenBackground style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" style={{ color: '#3a7d44' }}>My Garden</ThemedText>
        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <ThemedText style={styles.logoutText}>Log Out</ThemedText>
        </Pressable>
      </View>

      <FlatList
        data={beds}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <ThemedText style={styles.empty}>
            No garden beds yet.{'\n'}Tap + to add your first one.
          </ThemedText>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.bedCard}
            onPress={() => router.push({ pathname: '/bed/[id]', params: { id: item.id } })}
            onLongPress={() => handleDeleteBed(item.id)}
          >
            <ThemedText style={styles.bedName}>{item.name}</ThemedText>
            <ThemedText style={styles.bedHint}>Hold to delete</ThemedText>
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
        <ThemedText style={styles.fabText}>+</ThemedText>
      </Pressable>

      <Modal visible={modalVisible} transparent animationType="fade">
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
                onPress={() => { setModalVisible(false); setNewBedName(''); }}
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
    </GardenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  logoutBtn: { padding: 8 },
  logoutText: { color: '#3a7d44', fontSize: 15 },
  list: { paddingHorizontal: 20, paddingBottom: 100 },
  empty: {
    textAlign: 'center',
    color: '#888',
    marginTop: 60,
    lineHeight: 24,
    fontSize: 16,
  },
  bedCard: {
    backgroundColor: '#f0f7f0',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  bedName: { fontSize: 18, fontWeight: '600', color: '#2e5c35' },
  bedHint: { fontSize: 12, color: '#888', marginTop: 4 },
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
