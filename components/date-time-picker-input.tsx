import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  value: Date | null;
  onChange: (date: Date) => void;
  mode: 'date' | 'time';
  placeholder?: string;
};

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function DateTimePickerInput({ value, onChange, mode, placeholder }: Props) {
  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(value ?? new Date());

  const displayText = value
    ? mode === 'date' ? formatDate(value) : formatTime(value)
    : placeholder ?? (mode === 'date' ? 'Select date…' : 'Select time…');

  function handleOpen() {
    if (value) {
      setTempDate(value);
    } else {
      // Default to yesterday so tapping today always fires a change event
      // (onChange won't fire if the picker's current value already equals the tapped date)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      setTempDate(yesterday);
    }
    setShow(true);
  }

  function handleChange(_event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') {
      setShow(false);
      if (_event.type === 'set' && date) onChange(date);
    } else if (mode === 'date') {
      // Tap a date → auto-confirm and close; no Done button needed
      if (date) {
        onChange(date);
        setShow(false);
      }
    } else {
      // Time: user scrolls then presses Done
      if (date) setTempDate(date);
    }
  }

  function handleDone() {
    onChange(tempDate);
    setShow(false);
  }

  return (
    <>
      <Pressable style={styles.field} onPress={handleOpen}>
        <Text style={[styles.text, !value && styles.placeholder]}>{displayText}</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      {Platform.OS === 'ios' ? (
        <Modal visible={show} transparent animationType="slide">
          <View style={styles.iosOverlay}>
            <View style={[styles.iosSheet, mode === 'date' && styles.iosSheetTall]}>
              <View style={styles.iosToolbar}>
                <Pressable onPress={() => setShow(false)} style={styles.iosCancelBtn}>
                  <Text style={styles.iosCancelText}>Cancel</Text>
                </Pressable>
                <Text style={styles.iosTitle}>
                  {mode === 'date' ? 'Select Date' : 'Select Time'}
                </Text>
                {mode === 'time' ? (
                  <Pressable onPress={handleDone} style={styles.iosDoneBtn}>
                    <Text style={styles.iosDoneText}>Done</Text>
                  </Pressable>
                ) : (
                  <View style={styles.iosDoneBtn} />
                )}
              </View>
              <DateTimePicker
                value={tempDate}
                mode={mode}
                display={mode === 'time' ? 'spinner' : 'inline'}
                onChange={handleChange}
                style={styles.picker}
                themeVariant="light"
                accentColor="#3a7d44"
              />
            </View>
          </View>
        </Modal>
      ) : (
        show && (
          <DateTimePicker
            value={tempDate}
            mode={mode}
            display={mode === 'date' ? 'calendar' : 'spinner'}
            onChange={handleChange}
          />
        )
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#fff',
    marginBottom: 4,
  },
  text: { flex: 1, fontSize: 15, color: '#11181C' },
  placeholder: { color: '#aaa' },
  chevron: { fontSize: 20, color: '#aaa', lineHeight: 22 },
  iosOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  iosSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  iosSheetTall: {
    paddingBottom: 24,
  },
  iosToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  iosTitle: { fontSize: 16, fontWeight: '600', color: '#11181C' },
  iosCancelBtn: { padding: 4, minWidth: 60 },
  iosCancelText: { fontSize: 16, color: '#888' },
  iosDoneBtn: { padding: 4, minWidth: 60, alignItems: 'flex-end' },
  iosDoneText: { fontSize: 16, color: '#3a7d44', fontWeight: '700' },
  picker: { alignSelf: 'center' },
});
