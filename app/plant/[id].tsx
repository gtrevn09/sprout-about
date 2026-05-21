import { DateTimePickerInput } from '@/components/date-time-picker-input';
import { EmojiPicker } from '@/components/emoji-picker';
import { GardenBackground } from '@/components/garden-background';
import { ThemedText } from '@/components/themed-text';
import {
  addFertilizerLog,
  addPlantNote,
  addPlantPhoto,
  addTreatmentLog,
  clearPlantSchedule,
  clearTreatmentSchedule,
  deleteFertilizerLog,
  deletePlantNote,
  deletePlantPhoto,
  deleteTreatmentLog,
  FertilizerLog,
  getFertilizerLogs,
  getPlant,
  getPlantNotes,
  getPlantPhotos,
  getPlantSchedule,
  getTreatmentLogs,
  getTreatmentSchedule,
  MISSED_FERTILIZER_TYPE,
  MISSED_TREATMENT_TYPE,
  Plant,
  PlantNote,
  PlantPhoto,
  TreatmentLog,
  updateFertilizerLog,
  updatePlant,
  updateTreatmentLog,
  upsertPlantSchedule,
  upsertTreatmentSchedule,
} from '@/lib/database';
import { scheduleFertilizerReminder, scheduleTreatmentReminder } from '@/lib/notifications';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function defaultReminderTime() {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
}

function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function daysFromToday(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = parseLocalDate(dateStr);
  const today = todayStart();
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatScheduledDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function timeStringFromDate(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function PlantDetailScreen() {
  const { id, showConfirm } = useLocalSearchParams<{ id: string; showConfirm?: string }>();
  const plantId = Number(id);
  const navigation = useNavigation();
  const confirmShown = useRef(false);

  const [plant, setPlant] = useState<Plant | null>(null);
  const [name, setName] = useState('');
  const [plantedDate, setPlantedDate] = useState('');
  const [quantityStr, setQuantityStr] = useState('1');
  const [emoji, setEmoji] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PlantPhoto[]>([]);
  const [fertLogs, setFertLogs] = useState<FertilizerLog[]>([]);
  const [treatLogs, setTreatLogs] = useState<TreatmentLog[]>([]);
  const [plantNotes, setPlantNotes] = useState<PlantNote[]>([]);
  const [nextScheduledDate, setNextScheduledDate] = useState<string | null>(null);
  const [scheduleRepeatDays, setScheduleRepeatDays] = useState<number | null>(null);
  const [scheduleNotifTime, setScheduleNotifTime] = useState<string | null>(null);
  const [nextTreatDate, setNextTreatDate] = useState<string | null>(null);
  const [treatRepeatDays, setTreatRepeatDays] = useState<number | null>(null);
  const [treatNotifTime, setTreatNotifTime] = useState<string | null>(null);

  const [hasUnsaved, setHasUnsaved] = useState(false);

  // Confirm fertilization modal (from notification tap)
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);

  // Add fertilizer log modal
  const [fertModalVisible, setFertModalVisible] = useState(false);
  const [fertType, setFertType] = useState('');
  const [fertDate, setFertDate] = useState<Date | null>(null);
  const [fertNotes, setFertNotes] = useState('');

  // Edit missed entry modal
  const [editingLog, setEditingLog] = useState<FertilizerLog | null>(null);
  const [editFertType, setEditFertType] = useState('');
  const [editFertDate, setEditFertDate] = useState<Date | null>(null);
  const [editFertNotes, setEditFertNotes] = useState('');

  // Reminder modal
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertDate, setAlertDate] = useState<Date | null>(null);
  const [alertTime, setAlertTime] = useState<Date>(defaultReminderTime());
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatDaysInput, setRepeatDaysInput] = useState('');

  // Add treatment log modal
  const [treatModalVisible, setTreatModalVisible] = useState(false);
  const [treatType, setTreatType] = useState('');
  const [treatDate, setTreatDate] = useState<Date | null>(null);
  const [treatNotes, setTreatNotes] = useState('');

  // Edit missed treatment modal
  const [editingTreatLog, setEditingTreatLog] = useState<TreatmentLog | null>(null);
  const [editTreatType, setEditTreatType] = useState('');
  const [editTreatDate, setEditTreatDate] = useState<Date | null>(null);
  const [editTreatNotes, setEditTreatNotes] = useState('');

  // Treatment reminder modal
  const [treatAlertVisible, setTreatAlertVisible] = useState(false);
  const [treatAlertDate, setTreatAlertDate] = useState<Date | null>(null);
  const [treatAlertTime, setTreatAlertTime] = useState<Date>(defaultReminderTime());
  const [treatRepeatEnabled, setTreatRepeatEnabled] = useState(false);
  const [treatRepeatInput, setTreatRepeatInput] = useState('');

  // Add note modal
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteContent, setNoteContent] = useState('');

  // Full-screen photo viewer
  const [viewPhotoIndex, setViewPhotoIndex] = useState<number | null>(null);

  // Export selection mode
  const [exportMode, setExportMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<number>>(new Set());

  useEffect(() => { loadData(); }, [plantId]);

  useEffect(() => {
    if (showConfirm === '1' && !confirmShown.current) {
      confirmShown.current = true;
      setConfirmModalVisible(true);
    }
  }, [showConfirm]);

  function loadData() {
    const p = getPlant(plantId);
    if (p) {
      setPlant(p);
      setName(p.name);
      setPlantedDate(p.planted_date ?? '');
      setQuantityStr(String(p.quantity ?? 1));
      setEmoji(p.emoji ?? null);
      navigation.setOptions({ title: p.name });
    }
    setFertLogs(getFertilizerLogs(plantId));
    setTreatLogs(getTreatmentLogs(plantId));
    setPhotos(getPlantPhotos(plantId));
    setPlantNotes(getPlantNotes(plantId));
    const sched = getPlantSchedule(plantId);
    setNextScheduledDate(sched?.scheduled_for ?? null);
    setScheduleRepeatDays(sched?.repeat_days ?? null);
    setScheduleNotifTime(sched?.notification_time ?? null);
    const tsched = getTreatmentSchedule(plantId);
    setNextTreatDate(tsched?.scheduled_for ?? null);
    setTreatRepeatDays(tsched?.repeat_days ?? null);
    setTreatNotifTime(tsched?.notification_time ?? null);
  }

  function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a plant name.');
      return;
    }
    const qty = Math.max(1, parseInt(quantityStr, 10) || 1);
    updatePlant(plantId, name.trim(), plantedDate.trim() || null, plant?.notes ?? null, qty, emoji);
    navigation.setOptions({ title: name.trim() });
    setHasUnsaved(false);
    Alert.alert('Saved', 'Plant details updated.');
  }

  // ── Photos ──────────────────────────────────────────────────────────────────
  async function handleAddPhoto(source: 'camera' | 'library') {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera Permission Required', 'Enable camera access in Settings.');
        return;
      }
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      addPlantPhoto(plantId, result.assets[0].uri);
      setPhotos(getPlantPhotos(plantId));
    }
  }

  function toggleExportMode() {
    setExportMode(v => !v);
    setSelectedPhotoIds(new Set());
  }

  function togglePhotoSelected(id: number) {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAllPhotos() {
    setSelectedPhotoIds(new Set(photos.map(p => p.id)));
  }

  async function handleExportSelected() {
    if (selectedPhotoIds.size === 0) {
      Alert.alert('Nothing selected', 'Tap photos to select them first.');
      return;
    }
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Enable photo library access in Settings to export photos.');
      return;
    }
    const toExport = photos.filter(p => selectedPhotoIds.has(p.id));
    let saved = 0;
    for (const p of toExport) {
      try {
        await MediaLibrary.saveToLibraryAsync(p.photo_uri);
        saved++;
      } catch {}
    }
    setExportMode(false);
    setSelectedPhotoIds(new Set());
    Alert.alert('Export complete', `${saved} photo${saved === 1 ? '' : 's'} saved to your library.`);
  }

  function showPhotoOptions() {
    Alert.alert('Add Photo', 'Choose a source', [
      { text: 'Camera', onPress: () => handleAddPhoto('camera') },
      { text: 'Photo Library', onPress: () => handleAddPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleDeletePhoto(photoId: number) {
    Alert.alert('Delete Photo', 'Remove this photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        deletePlantPhoto(photoId); setPhotos(getPlantPhotos(plantId));
      }},
    ]);
  }

  // ── Fertilizer log ───────────────────────────────────────────────────────────
  function openFertModal(prefillDate?: Date) {
    setFertDate(prefillDate ?? null);
    setFertType('');
    setFertNotes('');
    setFertModalVisible(true);
  }

  function handleAddFertLog() {
    if (!fertType.trim()) {
      Alert.alert('Required', 'Please enter the fertilizer type.');
      return;
    }
    const date = fertDate ?? todayStart();
    addFertilizerLog(plantId, fertType.trim(), date.toISOString().slice(0, 10), fertNotes.trim() || null);
    setFertLogs(getFertilizerLogs(plantId));
    setFertType(''); setFertDate(null); setFertNotes('');
    setFertModalVisible(false);

    // Clear or reschedule so the overdue banner goes away
    const sched = getPlantSchedule(plantId);
    if (sched?.repeat_days) {
      autoReschedule(sched.repeat_days, sched.notification_time ?? '09:00');
    } else {
      clearPlantSchedule(plantId);
      setNextScheduledDate(null);
    }
  }

  function handleDeleteFertLog(logId: number) {
    Alert.alert('Delete Log', 'Remove this fertilizer entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        deleteFertilizerLog(logId); setFertLogs(getFertilizerLogs(plantId));
      }},
    ]);
  }

  function handleOpenEditMissed(log: FertilizerLog) {
    setEditingLog(log);
    setEditFertType('');
    setEditFertDate(null);
    setEditFertNotes('');
  }

  function handleSaveEditMissed() {
    if (!editFertType.trim() || !editingLog) {
      Alert.alert('Required', 'Please enter the fertilizer type.');
      return;
    }
    const date = editFertDate ?? todayStart();
    updateFertilizerLog(editingLog.id, editFertType.trim(), date.toISOString().slice(0, 10), editFertNotes.trim() || null);
    setFertLogs(getFertilizerLogs(plantId));
    setEditingLog(null);
  }

  // ── Treatment log ─────────────────────────────────────────────────────────────
  function openTreatModal(prefillDate?: Date) {
    setTreatDate(prefillDate ?? null);
    setTreatType('');
    setTreatNotes('');
    setTreatModalVisible(true);
  }

  function handleAddTreatLog() {
    if (!treatType.trim()) {
      Alert.alert('Required', 'Please enter the treatment / product name.');
      return;
    }
    const date = treatDate ?? todayStart();
    addTreatmentLog(plantId, treatType.trim(), date.toISOString().slice(0, 10), treatNotes.trim() || null);
    setTreatLogs(getTreatmentLogs(plantId));
    setTreatType(''); setTreatDate(null); setTreatNotes('');
    setTreatModalVisible(false);

    const tsched = getTreatmentSchedule(plantId);
    if (tsched?.repeat_days) {
      autoRescheduleTreat(tsched.repeat_days, tsched.notification_time ?? '09:00');
    } else {
      clearTreatmentSchedule(plantId);
      setNextTreatDate(null);
    }
  }

  function handleDeleteTreatLog(logId: number) {
    Alert.alert('Delete Entry', 'Remove this treatment entry?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        deleteTreatmentLog(logId); setTreatLogs(getTreatmentLogs(plantId));
      }},
    ]);
  }

  function handleOpenEditMissedTreat(log: TreatmentLog) {
    setEditingTreatLog(log);
    setEditTreatType('');
    setEditTreatDate(null);
    setEditTreatNotes('');
  }

  function handleSaveEditMissedTreat() {
    if (!editTreatType.trim() || !editingTreatLog) {
      Alert.alert('Required', 'Please enter the treatment / product name.');
      return;
    }
    const date = editTreatDate ?? todayStart();
    updateTreatmentLog(editingTreatLog.id, editTreatType.trim(), date.toISOString().slice(0, 10), editTreatNotes.trim() || null);
    setTreatLogs(getTreatmentLogs(plantId));
    setEditingTreatLog(null);
  }

  // ── Treatment auto-reschedule ────────────────────────────────────────────────
  async function autoRescheduleTreat(repeatDays: number, notifTime: string) {
    const [h, m] = notifTime.split(':').map(Number);
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + repeatDays);
    nextDate.setHours(h ?? 9, m ?? 0, 0, 0);
    const notifId = await scheduleTreatmentReminder(name || plant?.name || 'plant', plantId, nextDate);
    const scheduledStr = nextDate.toISOString().slice(0, 10);
    upsertTreatmentSchedule(plantId, scheduledStr, notifId, repeatDays, notifTime);
    setNextTreatDate(scheduledStr);
    setTreatRepeatDays(repeatDays);
    setTreatNotifTime(notifTime);
  }

  async function handleScheduleTreatAlert() {
    if (!treatAlertDate) {
      Alert.alert('Date required', 'Please select a date for the reminder.');
      return;
    }
    const combined = new Date(
      treatAlertDate.getFullYear(), treatAlertDate.getMonth(), treatAlertDate.getDate(),
      treatAlertTime.getHours(), treatAlertTime.getMinutes(), 0
    );
    if (combined <= new Date()) {
      Alert.alert('Invalid date', 'Please select a future date and time.');
      return;
    }
    const repeatDays = treatRepeatEnabled ? (parseInt(treatRepeatInput, 10) || null) : null;
    if (treatRepeatEnabled && !repeatDays) {
      Alert.alert('Invalid repeat', 'Please enter a valid number of days.');
      return;
    }
    const notifTime = timeStringFromDate(treatAlertTime);
    const notifId = await scheduleTreatmentReminder(name || plant?.name || 'plant', plantId, combined);
    const scheduledStr = treatAlertDate.toISOString().slice(0, 10);
    upsertTreatmentSchedule(plantId, scheduledStr, notifId, repeatDays, notifTime);
    setNextTreatDate(scheduledStr);
    setTreatRepeatDays(repeatDays);
    setTreatNotifTime(notifTime);

    setTreatAlertVisible(false);
    setTreatAlertDate(null);
    setTreatAlertTime(defaultReminderTime());
    setTreatRepeatEnabled(false);
    setTreatRepeatInput('');

    if (notifId) {
      const label = combined.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const time = combined.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const repeatNote = repeatDays ? ` — repeats every ${repeatDays} day${repeatDays === 1 ? '' : 's'}` : '';
      Alert.alert('Reminder Set', `You'll be notified on ${label} at ${time}${repeatNote}.`);
    } else {
      Alert.alert('Permission denied', 'Enable notifications in Settings to use reminders.');
    }
  }

  // ── Repeat auto-reschedule ───────────────────────────────────────────────────
  async function autoReschedule(repeatDays: number, notifTime: string) {
    const [h, m] = notifTime.split(':').map(Number);
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + repeatDays);
    nextDate.setHours(h ?? 9, m ?? 0, 0, 0);
    const notifId = await scheduleFertilizerReminder(name || plant?.name || 'plant', plantId, nextDate);
    const scheduledStr = nextDate.toISOString().slice(0, 10);
    upsertPlantSchedule(plantId, scheduledStr, notifId, repeatDays, notifTime);
    setNextScheduledDate(scheduledStr);
    setScheduleRepeatDays(repeatDays);
    setScheduleNotifTime(notifTime);
  }

  // ── Confirm (from notification) ──────────────────────────────────────────────
  function handleConfirmYes() {
    setConfirmModalVisible(false);
    const sched = getPlantSchedule(plantId);
    if (sched?.repeat_days) {
      autoReschedule(sched.repeat_days, sched.notification_time ?? '09:00');
    } else {
      clearPlantSchedule(plantId);
      setNextScheduledDate(null);
    }
    openFertModal(todayStart());
  }

  function handleConfirmNo() {
    addFertilizerLog(plantId, MISSED_FERTILIZER_TYPE, new Date().toISOString().slice(0, 10), null);
    setFertLogs(getFertilizerLogs(plantId));
    const sched = getPlantSchedule(plantId);
    if (sched?.repeat_days) {
      autoReschedule(sched.repeat_days, sched.notification_time ?? '09:00');
    } else {
      clearPlantSchedule(plantId);
      setNextScheduledDate(null);
    }
    setConfirmModalVisible(false);
  }

  // ── Reminder ──────────────────────────────────────────────────────────────────
  async function handleScheduleAlert() {
    if (!alertDate) {
      Alert.alert('Date required', 'Please select a date for the reminder.');
      return;
    }
    const combined = new Date(
      alertDate.getFullYear(), alertDate.getMonth(), alertDate.getDate(),
      alertTime.getHours(), alertTime.getMinutes(), 0
    );
    if (combined <= new Date()) {
      Alert.alert('Invalid date', 'Please select a future date and time.');
      return;
    }
    const repeatDays = repeatEnabled ? (parseInt(repeatDaysInput, 10) || null) : null;
    if (repeatEnabled && !repeatDays) {
      Alert.alert('Invalid repeat', 'Please enter a valid number of days.');
      return;
    }
    const notifTime = timeStringFromDate(alertTime);
    const notifId = await scheduleFertilizerReminder(name || plant?.name || 'plant', plantId, combined);
    const scheduledStr = alertDate.toISOString().slice(0, 10);
    upsertPlantSchedule(plantId, scheduledStr, notifId, repeatDays, notifTime);
    setNextScheduledDate(scheduledStr);
    setScheduleRepeatDays(repeatDays);
    setScheduleNotifTime(notifTime);

    setAlertModalVisible(false);
    setAlertDate(null);
    setAlertTime(defaultReminderTime());
    setRepeatEnabled(false);
    setRepeatDaysInput('');

    if (notifId) {
      const label = combined.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const time = combined.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const repeatNote = repeatDays ? ` — repeats every ${repeatDays} day${repeatDays === 1 ? '' : 's'}` : '';
      Alert.alert('Reminder Set', `You'll be notified on ${label} at ${time}${repeatNote}.`);
    } else {
      Alert.alert('Permission denied', 'Enable notifications in Settings to use reminders.');
    }
  }

  // ── Notes ─────────────────────────────────────────────────────────────────────
  function handleAddNote() {
    if (!noteContent.trim()) return;
    addPlantNote(plantId, noteContent.trim());
    setPlantNotes(getPlantNotes(plantId));
    setNoteContent('');
    setNoteModalVisible(false);
  }

  function handleDeleteNote(noteId: number) {
    Alert.alert('Delete Note', 'Remove this note?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        deletePlantNote(noteId); setPlantNotes(getPlantNotes(plantId));
      }},
    ]);
  }

  // ── Banners ───────────────────────────────────────────────────────────────────
  const daysUntil = daysFromToday(nextScheduledDate);
  const bannerColor =
    daysUntil === null ? null :
    daysUntil <= 0 ? '#c0392b' :
    daysUntil <= 7 ? '#e67e22' : '#3a7d44';

  const bannerText =
    daysUntil === null ? null :
    daysUntil < 0 ? `Fertilization overdue by ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'} — tap to log` :
    daysUntil === 0 ? 'Fertilize today! — tap to log' :
    daysUntil === 1 ? 'Fertilize tomorrow!' :
    `Fertilize in ${daysUntil} days`;

  const bannerTappable = daysUntil !== null && daysUntil <= 0;

  const daysUntilTreat = daysFromToday(nextTreatDate);
  const treatBannerColor =
    daysUntilTreat === null ? null :
    daysUntilTreat <= 0 ? '#7b3fa0' :
    daysUntilTreat <= 7 ? '#5c6bc0' : '#3a7d44';

  const treatBannerText =
    daysUntilTreat === null ? null :
    daysUntilTreat < 0 ? `Treatment overdue by ${Math.abs(daysUntilTreat)} day${Math.abs(daysUntilTreat) === 1 ? '' : 's'} — tap to log` :
    daysUntilTreat === 0 ? 'Apply treatment today! — tap to log' :
    daysUntilTreat === 1 ? 'Apply treatment tomorrow!' :
    `Treatment in ${daysUntilTreat} days`;

  const treatBannerTappable = daysUntilTreat !== null && daysUntilTreat <= 0;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <GardenBackground style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Fertilizer countdown banner */}
        {bannerText && (
          <Pressable
            style={[styles.banner, { backgroundColor: bannerColor! }]}
            onPress={bannerTappable ? () => openFertModal(todayStart()) : undefined}
          >
            <Text style={styles.bannerText}>{bannerText}</Text>
          </Pressable>
        )}

        {/* Treatment countdown banner */}
        {treatBannerText && (
          <Pressable
            style={[styles.banner, { backgroundColor: treatBannerColor! }]}
            onPress={treatBannerTappable ? () => openTreatModal(todayStart()) : undefined}
          >
            <Text style={styles.bannerText}>{treatBannerText}</Text>
          </Pressable>
        )}

        {/* Plant Info */}
        <View style={[styles.section, { borderColor: '#2e7d32' }]}>
          <View style={[styles.secHead, { backgroundColor: '#2e7d32' }]}>
            <Text style={styles.secIcon}>🌿</Text>
            <Text style={styles.secTitle}>PLANT INFO</Text>
            <Text style={styles.secDeco}>· 🍃 ·</Text>
          </View>
          <View style={styles.secBody}>
          <ThemedText style={styles.fieldLabel}>Name</ThemedText>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(v) => { setName(v); setHasUnsaved(true); }}
            placeholder="Plant name"
            placeholderTextColor="#aaa"
          />
          <ThemedText style={styles.fieldLabel}>Quantity</ThemedText>
          <TextInput
            style={styles.input}
            value={quantityStr}
            onChangeText={(v) => { setQuantityStr(v); setHasUnsaved(true); }}
            placeholder="1"
            placeholderTextColor="#aaa"
            keyboardType="number-pad"
          />
          <ThemedText style={styles.fieldLabel}>Date Planted</ThemedText>
          <DateTimePickerInput
            value={plantedDate ? parseLocalDate(plantedDate) : null}
            onChange={(date) => {
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, '0');
              const d = String(date.getDate()).padStart(2, '0');
              setPlantedDate(`${y}-${m}-${d}`);
              setHasUnsaved(true);
            }}
            mode="date"
            placeholder="Select planting date…"
          />
          {plantedDate ? (() => {
            const days = Math.floor(
              (todayStart().getTime() - parseLocalDate(plantedDate).getTime()) / (1000 * 60 * 60 * 24)
            );
            const label =
              days === 0 ? 'Planted today' :
              days === 1 ? '1 day since planting' :
              days > 1 ? `${days} days since planting` :
              `Planting date is ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} away`;
            return (
              <View style={styles.daysSinceBox}>
                <Text style={styles.daysSinceEmoji}>🌱</Text>
                <Text style={styles.daysSinceText}>{label}</Text>
              </View>
            );
          })() : null}
          <ThemedText style={styles.fieldLabel}>Plant Icon</ThemedText>
          <EmojiPicker value={emoji} onChange={(e) => {
            setEmoji(e);
            const qty = Math.max(1, parseInt(quantityStr, 10) || 1);
            updatePlant(plantId, name.trim() || (plant?.name ?? ''), plantedDate.trim() || null, plant?.notes ?? null, qty, e);
          }} />
          <Pressable style={[styles.btnGreen, !hasUnsaved && styles.btnDisabled]} onPress={handleSave}>
            <Text style={styles.btnGreenText}>Save Changes</Text>
          </Pressable>
          </View>
        </View>

        {/* Notes */}
        <View style={[styles.section, { borderColor: '#5d4037' }]}>
          <View style={[styles.secHead, { backgroundColor: '#5d4037' }]}>
            <Text style={styles.secIcon}>🍀</Text>
            <Text style={styles.secTitle}>NOTES</Text>
            <Text style={styles.secDeco}>· 🌱 ·</Text>
          </View>
          <View style={styles.secBody}>
          {plantNotes.length === 0 ? (
            <ThemedText style={styles.emptySmall}>No notes yet. Add your first observation.</ThemedText>
          ) : (
            plantNotes.map((note) => (
              <Pressable key={note.id} style={styles.noteRow} onLongPress={() => handleDeleteNote(note.id)}>
                <Text style={styles.noteDate}>
                  {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <Text style={styles.noteContent}>{note.content}</Text>
              </Pressable>
            ))
          )}
          <Pressable style={styles.btnOutline} onPress={() => setNoteModalVisible(true)}>
            <Text style={styles.btnOutlineText}>
              {plantNotes.length === 0 ? '+ Add Initial Note' : '+ Add New Note'}
            </Text>
          </Pressable>
          </View>
        </View>

        {/* Photos */}
        <View style={[styles.section, { borderColor: '#00695c' }]}>
          <View style={[styles.secHead, { backgroundColor: '#00695c' }]}>
            <Text style={styles.secIcon}>🌸</Text>
            <Text style={styles.secTitle}>GROWTH PHOTOS</Text>
            <Text style={styles.secDeco}>· 🌺 ·</Text>
          </View>
          <View style={styles.secBody}>
          {photos.length === 0 ? (
            <ThemedText style={styles.emptySmall}>No photos yet. Add one to track growth.</ThemedText>
          ) : (
            <>
              {exportMode && (
                <Pressable style={styles.selectAllBtn} onPress={selectAllPhotos}>
                  <Text style={styles.selectAllText}>Select All ({photos.length})</Text>
                </Pressable>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
                {photos.map((p) => {
                  const selected = selectedPhotoIds.has(p.id);
                  return (
                    <Pressable
                      key={p.id}
                      style={styles.photoThumb}
                      onPress={exportMode ? () => togglePhotoSelected(p.id) : () => setViewPhotoIndex(photos.indexOf(p))}
                      onLongPress={exportMode ? undefined : () => handleDeletePhoto(p.id)}
                    >
                      <Image source={{ uri: p.photo_uri }} style={[styles.photoImg, selected && styles.photoImgSelected]} />
                      {exportMode && (
                        <View style={[styles.photoCheckCircle, selected && styles.photoCheckCircleOn]}>
                          {selected && <Text style={styles.photoCheckMark}>✓</Text>}
                        </View>
                      )}
                      <Text style={styles.photoDate}>{p.taken_at.slice(0, 10)}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          {exportMode ? (
            <View style={styles.exportActionRow}>
              <Pressable style={styles.btnCancel} onPress={toggleExportMode}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.btnAdd, selectedPhotoIds.size === 0 && styles.btnDisabled]} onPress={handleExportSelected}>
                <Text style={styles.btnAddText}>
                  Export{selectedPhotoIds.size > 0 ? ` (${selectedPhotoIds.size})` : ''}
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable style={styles.btnOutline} onPress={showPhotoOptions}>
                <Text style={styles.btnOutlineText}>+ Add Photo</Text>
              </Pressable>
              {photos.length > 0 && (
                <Pressable style={[styles.btnOutline, { borderColor: '#555', marginTop: 8 }]} onPress={toggleExportMode}>
                  <Text style={[styles.btnOutlineText, { color: '#555' }]}>Export Photos</Text>
                </Pressable>
              )}
            </>
          )}
          </View>
        </View>

        {/* Fertilizer Log */}
        <View style={[styles.section, { borderColor: '#33691e' }]}>
          <View style={[styles.secHead, { backgroundColor: '#33691e' }]}>
            <Text style={styles.secIcon}>🌾</Text>
            <Text style={styles.secTitle}>FERTILIZER LOG</Text>
            <Text style={styles.secDeco}>· 🍃 ·</Text>
          </View>
          <View style={styles.secBody}>
          {fertLogs.length === 0 ? (
            <ThemedText style={styles.emptySmall}>No fertilizer entries yet.</ThemedText>
          ) : (
            fertLogs.map((log) => {
              const isMissed = log.fertilizer_type === MISSED_FERTILIZER_TYPE;
              return (
                <Pressable
                  key={log.id}
                  style={[styles.fertRow, isMissed && styles.fertRowMissed]}
                  onPress={isMissed ? () => handleOpenEditMissed(log) : undefined}
                  onLongPress={() => handleDeleteFertLog(log.id)}
                >
                  <View style={styles.fertRowLeft}>
                    <Text style={[styles.fertType, isMissed && styles.fertTypeMissed]}>
                      {isMissed ? '⚠ Missed scheduled fertilization' : log.fertilizer_type}
                    </Text>
                    {isMissed
                      ? <Text style={styles.fertTapHint}>Tap to log actual details</Text>
                      : log.notes ? <Text style={styles.fertNotes}>{log.notes}</Text> : null}
                  </View>
                  <Text style={[styles.fertDate, isMissed && styles.fertDateMissed]}>{log.fertilized_at}</Text>
                </Pressable>
              );
            })
          )}

          {nextScheduledDate && (
            <View style={styles.scheduleRow}>
              <Text style={styles.scheduleText}>
                📅  Next scheduled: {formatScheduledDate(nextScheduledDate)}
                {scheduleRepeatDays ? `  ·  repeats every ${scheduleRepeatDays}d` : ''}
              </Text>
            </View>
          )}

          <Pressable style={styles.btnOutline} onPress={() => openFertModal()}>
            <Text style={styles.btnOutlineText}>+ Log Fertilizer</Text>
          </Pressable>
          <Pressable style={[styles.btnOutline, styles.btnAlert]} onPress={() => setAlertModalVisible(true)}>
            <Text style={styles.btnAlertText}>Schedule Next Reminder</Text>
          </Pressable>
          </View>
        </View>

        {/* Treatment Log */}
        <View style={[styles.section, { borderColor: '#6a1b9a' }]}>
          <View style={[styles.secHead, { backgroundColor: '#6a1b9a' }]}>
            <Text style={styles.secIcon}>🌺</Text>
            <Text style={styles.secTitle}>TREATMENT LOG</Text>
            <Text style={styles.secDeco}>· 🌿 ·</Text>
          </View>
          <View style={styles.secBody}>
          {treatLogs.length === 0 ? (
            <ThemedText style={styles.emptySmall}>No treatment entries yet.</ThemedText>
          ) : (
            treatLogs.map((log) => {
              const isMissed = log.treatment_type === MISSED_TREATMENT_TYPE;
              return (
                <Pressable
                  key={log.id}
                  style={[styles.fertRow, isMissed && styles.fertRowMissed]}
                  onPress={isMissed ? () => handleOpenEditMissedTreat(log) : undefined}
                  onLongPress={() => handleDeleteTreatLog(log.id)}
                >
                  <View style={styles.fertRowLeft}>
                    <Text style={[styles.fertType, isMissed && styles.fertTypeMissed]}>
                      {isMissed ? '⚠ Missed scheduled treatment' : log.treatment_type}
                    </Text>
                    {isMissed
                      ? <Text style={styles.fertTapHint}>Tap to log actual details</Text>
                      : log.notes ? <Text style={styles.fertNotes}>{log.notes}</Text> : null}
                  </View>
                  <Text style={[styles.fertDate, isMissed && styles.fertDateMissed]}>{log.treated_at}</Text>
                </Pressable>
              );
            })
          )}

          {nextTreatDate && (
            <View style={styles.scheduleRow}>
              <Text style={styles.scheduleText}>
                📅  Next treatment: {formatScheduledDate(nextTreatDate)}
                {treatRepeatDays ? `  ·  repeats every ${treatRepeatDays}d` : ''}
              </Text>
            </View>
          )}

          <Pressable style={styles.btnOutline} onPress={() => openTreatModal()}>
            <Text style={styles.btnOutlineText}>+ Log Treatment</Text>
          </Pressable>
          <Pressable style={[styles.btnOutline, styles.btnTreatAlert]} onPress={() => setTreatAlertVisible(true)}>
            <Text style={styles.btnTreatAlertText}>Schedule Next Reminder</Text>
          </Pressable>
          </View>
        </View>

      </ScrollView>

      {/* Full-screen swipeable photo viewer */}
      <Modal visible={viewPhotoIndex !== null} transparent animationType="fade">
        <View style={styles.photoModalBg}>
          <Pressable style={styles.photoModalClose} onPress={() => setViewPhotoIndex(null)}>
            <Text style={styles.photoModalCloseText}>✕</Text>
          </Pressable>
          {viewPhotoIndex !== null && (
            <>
              <Text style={styles.photoModalCounter}>
                {viewPhotoIndex + 1} / {photos.length}
              </Text>
              <FlatList
                data={photos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={viewPhotoIndex}
                getItemLayout={(_, index) => ({
                  length: SCREEN_WIDTH,
                  offset: SCREEN_WIDTH * index,
                  index,
                })}
                onMomentumScrollEnd={(e) => {
                  setViewPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
                }}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                  <View style={styles.photoSlide}>
                    <Image source={{ uri: item.photo_uri }} style={styles.photoFull} resizeMode="contain" />
                    <Text style={styles.photoSlideDate}>{item.taken_at.slice(0, 10)}</Text>
                  </View>
                )}
              />
            </>
          )}
        </View>
      </Modal>

      {/* Confirm fertilization */}
      <Modal visible={confirmModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.confirmIcon}>🌱</Text>
            <Text style={styles.confirmTitle}>Did you apply fertilizer today?</Text>
            <Text style={styles.confirmSub}>Scheduled reminder for: {name || 'your plant'}</Text>
            <Pressable style={styles.btnGreenFull} onPress={handleConfirmYes}>
              <Text style={styles.btnGreenText}>Yes, I fertilized!</Text>
            </Pressable>
            <Pressable style={styles.btnMissedFull} onPress={handleConfirmNo}>
              <Text style={styles.btnMissedText}>No, I missed it</Text>
            </Pressable>
            <Pressable style={styles.btnDismiss} onPress={() => setConfirmModalVisible(false)}>
              <Text style={styles.btnDismissText}>Remind me later</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Add Note */}
      <Modal visible={noteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Note</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="What did you observe today?"
              placeholderTextColor="#aaa"
              value={noteContent}
              onChangeText={setNoteContent}
              multiline
              numberOfLines={4}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <Pressable style={styles.btnCancel} onPress={() => { setNoteModalVisible(false); setNoteContent(''); }}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnAdd} onPress={handleAddNote}>
                <Text style={styles.btnAddText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Fertilizer Log */}
      <Modal visible={fertModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Log Fertilizer</Text>
            <Text style={styles.fieldLabelDark}>Fertilizer Type</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Tomato Tone 3-4-6"
              placeholderTextColor="#aaa"
              value={fertType}
              onChangeText={setFertType}
            />
            <Text style={styles.fieldLabelDark}>Date Applied</Text>
            <DateTimePickerInput value={fertDate} onChange={setFertDate} mode="date" placeholder="Select date…" />
            <Text style={styles.fieldLabelDark}>Notes (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Amount used, observations…"
              placeholderTextColor="#aaa"
              value={fertNotes}
              onChangeText={setFertNotes}
            />
            <View style={styles.modalBtns}>
              <Pressable style={styles.btnCancel} onPress={() => { setFertModalVisible(false); setFertType(''); setFertDate(null); setFertNotes(''); }}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnAdd} onPress={handleAddFertLog}>
                <Text style={styles.btnAddText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Missed Entry */}
      <Modal visible={!!editingLog} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Update Missed Entry</Text>
            <Text style={styles.fieldLabelDark}>Fertilizer Type</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Tomato Tone 3-4-6"
              placeholderTextColor="#aaa"
              value={editFertType}
              onChangeText={setEditFertType}
            />
            <Text style={styles.fieldLabelDark}>Date Applied</Text>
            <DateTimePickerInput value={editFertDate} onChange={setEditFertDate} mode="date" placeholder="Select date…" />
            <Text style={styles.fieldLabelDark}>Notes (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Amount used, observations…"
              placeholderTextColor="#aaa"
              value={editFertNotes}
              onChangeText={setEditFertNotes}
            />
            <View style={styles.modalBtns}>
              <Pressable style={styles.btnCancel} onPress={() => setEditingLog(null)}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnAdd} onPress={handleSaveEditMissed}>
                <Text style={styles.btnAddText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Treatment Log */}
      <Modal visible={treatModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Log Treatment</Text>
            <Text style={styles.fieldLabelDark}>Treatment / Product</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Neem Oil, Pyrethrin Spray"
              placeholderTextColor="#aaa"
              value={treatType}
              onChangeText={setTreatType}
            />
            <Text style={styles.fieldLabelDark}>Date Applied</Text>
            <DateTimePickerInput value={treatDate} onChange={setTreatDate} mode="date" placeholder="Select date…" />
            <Text style={styles.fieldLabelDark}>Notes (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Concentration, target pest, observations…"
              placeholderTextColor="#aaa"
              value={treatNotes}
              onChangeText={setTreatNotes}
            />
            <View style={styles.modalBtns}>
              <Pressable style={styles.btnCancel} onPress={() => { setTreatModalVisible(false); setTreatType(''); setTreatDate(null); setTreatNotes(''); }}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnAdd} onPress={handleAddTreatLog}>
                <Text style={styles.btnAddText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Missed Treatment */}
      <Modal visible={!!editingTreatLog} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Update Missed Treatment</Text>
            <Text style={styles.fieldLabelDark}>Treatment / Product</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Neem Oil"
              placeholderTextColor="#aaa"
              value={editTreatType}
              onChangeText={setEditTreatType}
            />
            <Text style={styles.fieldLabelDark}>Date Applied</Text>
            <DateTimePickerInput value={editTreatDate} onChange={setEditTreatDate} mode="date" placeholder="Select date…" />
            <Text style={styles.fieldLabelDark}>Notes (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Concentration, target pest, observations…"
              placeholderTextColor="#aaa"
              value={editTreatNotes}
              onChangeText={setEditTreatNotes}
            />
            <View style={styles.modalBtns}>
              <Pressable style={styles.btnCancel} onPress={() => setEditingTreatLog(null)}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnAdd} onPress={handleSaveEditMissedTreat}>
                <Text style={styles.btnAddText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Schedule Treatment Reminder */}
      <Modal visible={treatAlertVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Schedule Treatment Reminder</Text>
            <Text style={styles.fieldLabelDark}>Date</Text>
            <DateTimePickerInput value={treatAlertDate} onChange={setTreatAlertDate} mode="date" placeholder="Select date…" />
            <Text style={styles.fieldLabelDark}>Time</Text>
            <DateTimePickerInput value={treatAlertTime} onChange={setTreatAlertTime} mode="time" />
            <Pressable
              style={[styles.repeatToggle, treatRepeatEnabled && styles.repeatToggleOn]}
              onPress={() => setTreatRepeatEnabled(v => !v)}
            >
              <Text style={[styles.repeatToggleText, treatRepeatEnabled && styles.repeatToggleTextOn]}>
                {treatRepeatEnabled ? '✓  Repeat Reminder: ON' : 'Repeat Reminder: OFF'}
              </Text>
            </Pressable>
            {treatRepeatEnabled && (
              <View style={styles.repeatDaysRow}>
                <Text style={styles.fieldLabelDark}>Repeat every</Text>
                <TextInput
                  style={styles.repeatDaysInput}
                  value={treatRepeatInput}
                  onChangeText={setTreatRepeatInput}
                  keyboardType="number-pad"
                  placeholder="14"
                  placeholderTextColor="#aaa"
                  maxLength={3}
                />
                <Text style={styles.repeatDaysUnit}>days</Text>
              </View>
            )}
            <View style={styles.modalBtns}>
              <Pressable style={styles.btnCancel} onPress={() => {
                setTreatAlertVisible(false);
                setTreatAlertDate(null);
                setTreatAlertTime(defaultReminderTime());
                setTreatRepeatEnabled(false);
                setTreatRepeatInput('');
              }}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnAdd} onPress={handleScheduleTreatAlert}>
                <Text style={styles.btnAddText}>Set Reminder</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Schedule Reminder */}
      <Modal visible={alertModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Schedule Fertilizer Reminder</Text>
            <Text style={styles.fieldLabelDark}>Date</Text>
            <DateTimePickerInput value={alertDate} onChange={setAlertDate} mode="date" placeholder="Select date…" />
            <Text style={styles.fieldLabelDark}>Time</Text>
            <DateTimePickerInput value={alertTime} onChange={setAlertTime} mode="time" />

            {/* Repeat */}
            <Pressable
              style={[styles.repeatToggle, repeatEnabled && styles.repeatToggleOn]}
              onPress={() => setRepeatEnabled(v => !v)}
            >
              <Text style={[styles.repeatToggleText, repeatEnabled && styles.repeatToggleTextOn]}>
                {repeatEnabled ? '✓  Repeat Reminder: ON' : 'Repeat Reminder: OFF'}
              </Text>
            </Pressable>
            {repeatEnabled && (
              <View style={styles.repeatDaysRow}>
                <Text style={styles.fieldLabelDark}>Repeat every</Text>
                <TextInput
                  style={styles.repeatDaysInput}
                  value={repeatDaysInput}
                  onChangeText={setRepeatDaysInput}
                  keyboardType="number-pad"
                  placeholder="14"
                  placeholderTextColor="#aaa"
                  maxLength={3}
                />
                <Text style={styles.repeatDaysUnit}>days</Text>
              </View>
            )}

            <View style={styles.modalBtns}>
              <Pressable style={styles.btnCancel} onPress={() => {
                setAlertModalVisible(false);
                setAlertDate(null);
                setAlertTime(defaultReminderTime());
                setRepeatEnabled(false);
                setRepeatDaysInput('');
              }}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnAdd} onPress={handleScheduleAlert}>
                <Text style={styles.btnAddText}>Set Reminder</Text>
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
  scroll: { paddingBottom: 60 },
  section: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  secHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  secIcon: { fontSize: 16 },
  secTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#fff',
  },
  secDeco: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  secBody: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    padding: 16,
  },
  banner: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  bannerText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#3a7d44',
    letterSpacing: 1, marginBottom: 8, marginTop: 20, paddingHorizontal: 20,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#e0e0e0', marginHorizontal: 20,
  },
  fieldLabel: { fontSize: 13, color: '#666', marginBottom: 4, marginTop: 10 },
  fieldLabelDark: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: '#11181C', backgroundColor: '#fff', marginBottom: 4,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  btnGreen: {
    backgroundColor: '#3a7d44', paddingVertical: 13,
    borderRadius: 10, alignItems: 'center', marginTop: 14,
  },
  btnDisabled: { backgroundColor: '#a5c8a8' },
  btnGreenText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnGreenFull: {
    backgroundColor: '#3a7d44', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center', marginTop: 16,
  },
  btnMissedFull: {
    backgroundColor: '#e67e22', paddingVertical: 14,
    borderRadius: 12, alignItems: 'center', marginTop: 10,
  },
  btnMissedText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDismiss: { alignItems: 'center', marginTop: 14 },
  btnDismissText: { color: '#888', fontSize: 14 },
  btnOutline: {
    borderWidth: 1.5, borderColor: '#3a7d44',
    paddingVertical: 11, borderRadius: 10, alignItems: 'center', marginTop: 12,
  },
  btnOutlineText: { color: '#3a7d44', fontWeight: '600', fontSize: 15 },
  btnAlert: { borderColor: '#e67e22', marginTop: 8 },
  btnAlertText: { color: '#e67e22', fontWeight: '600', fontSize: 15 },
  btnTreatAlert: { borderColor: '#7b3fa0', marginTop: 8 },
  btnTreatAlertText: { color: '#7b3fa0', fontWeight: '600', fontSize: 15 },
  daysSinceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f7f0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  daysSinceEmoji: { fontSize: 18 },
  daysSinceText: { fontSize: 15, fontWeight: '600', color: '#2e5c35' },
  emptySmall: { color: '#999', fontSize: 14, marginBottom: 4 },
  noteRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e0e0e0' },
  noteDate: { fontSize: 12, color: '#3a7d44', fontWeight: '600', marginBottom: 4 },
  noteContent: { fontSize: 15, color: '#11181C', lineHeight: 21 },
  photoRow: { marginBottom: 4 },
  photoThumb: { marginRight: 10, alignItems: 'center' },
  photoImg: { width: 90, height: 90, borderRadius: 10, backgroundColor: '#ddd' },
  photoImgSelected: { opacity: 0.7, borderWidth: 3, borderColor: '#3a7d44' },
  photoDate: { fontSize: 11, color: '#888', marginTop: 3 },
  photoCheckCircle: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoCheckCircleOn: { backgroundColor: '#3a7d44', borderColor: '#3a7d44' },
  photoCheckMark: { color: '#fff', fontSize: 13, fontWeight: '700', lineHeight: 16 },
  selectAllBtn: {
    alignSelf: 'flex-start', marginBottom: 8,
    paddingVertical: 5, paddingHorizontal: 12,
    borderRadius: 8, backgroundColor: '#eaf4eb',
    borderWidth: 1, borderColor: '#3a7d44',
  },
  selectAllText: { fontSize: 13, color: '#3a7d44', fontWeight: '600' },
  exportActionRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  fertRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee',
  },
  fertRowMissed: { backgroundColor: '#fff8f0', borderRadius: 8, paddingHorizontal: 8, marginBottom: 4 },
  fertRowLeft: { flex: 1, paddingRight: 12 },
  fertType: { fontSize: 15, fontWeight: '600', color: '#2e5c35' },
  fertTypeMissed: { color: '#e67e22' },
  fertTapHint: { fontSize: 12, color: '#aaa', marginTop: 2, fontStyle: 'italic' },
  fertNotes: { fontSize: 13, color: '#666', marginTop: 2 },
  fertDate: { fontSize: 13, color: '#888', paddingTop: 2 },
  fertDateMissed: { color: '#e67e22' },
  scheduleRow: {
    marginTop: 14, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: '#f0f7f0', borderRadius: 8, borderWidth: 1, borderColor: '#c8e6c9',
  },
  scheduleText: { fontSize: 14, color: '#3a7d44', fontWeight: '600' },
  repeatToggle: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#ccc',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  repeatToggleOn: {
    borderColor: '#3a7d44',
    backgroundColor: '#eaf4eb',
  },
  repeatToggleText: { fontSize: 15, fontWeight: '600', color: '#888' },
  repeatToggleTextOn: { color: '#3a7d44' },
  repeatDaysRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8,
  },
  repeatDaysInput: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: '#11181C', backgroundColor: '#fff',
    width: 80, textAlign: 'center',
  },
  repeatDaysUnit: { fontSize: 15, color: '#555' },
  photoModalBg: {
    flex: 1,
    backgroundColor: '#000',
  },
  photoModalClose: {
    position: 'absolute', top: 52, right: 20, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoModalCloseText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  photoModalCounter: {
    position: 'absolute', top: 58, alignSelf: 'center', zIndex: 10,
    color: '#fff', fontSize: 15, fontWeight: '600',
  },
  photoSlide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoFull: { width: SCREEN_WIDTH, height: '80%' },
  photoSlideDate: {
    color: 'rgba(255,255,255,0.6)', fontSize: 13,
    marginTop: 12, textAlign: 'center',
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', paddingHorizontal: 28,
  },
  modal: { backgroundColor: '#fff', borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#11181C', marginBottom: 6 },
  confirmIcon: { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  confirmTitle: { fontSize: 20, fontWeight: '700', color: '#3a7d44', textAlign: 'center', marginBottom: 6 },
  confirmSub: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 4 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 16 },
  btnCancel: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#ccc',
  },
  btnCancelText: { color: '#444', fontWeight: '500' },
  btnAdd: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#3a7d44',
  },
  btnAddText: { color: '#fff', fontWeight: '700' },
});
