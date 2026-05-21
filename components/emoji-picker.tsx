import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export const PLANT_EMOJIS = [
  // Vegetables
  '🥕', '🥦', '🧅', '🧄', '🌽', '🫑', '🥒', '🍆', '🍅', '🌶️',
  '🥬', '🥑', '🫛', '🥔', '🌰', '🫘',
  // Fruits
  '🍓', '🍇', '🍒', '🍑', '🍋', '🍊', '🍎', '🍐', '🫐', '🍉',
  '🍌', '🍈', '🍏', '🥝', '🍍', '🥭',
  // Flowers
  '🌸', '🌺', '🌻', '🌹', '🌷', '💐', '🌼', '🏵️', '🪷',
  // Herbs & plants
  '🌿', '🪴', '🌱', '🍀', '🌾', '🍃', '🪻', '🫚', '🌲', '🎋',
];

type Props = {
  value: string | null;
  onChange: (emoji: string | null) => void;
};

export function EmojiPicker({ value, onChange }: Props) {
  return (
    <View>
      {/* Clear button when something is selected */}
      {value && (
        <Pressable style={ep.clearRow} onPress={() => onChange(null)}>
          <Text style={ep.clearText}>✕  Remove emoji</Text>
        </Pressable>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ep.scroll}>
        <View style={ep.grid}>
          {PLANT_EMOJIS.map(e => (
            <Pressable
              key={e}
              style={[ep.btn, value === e && ep.btnSelected]}
              onPress={() => onChange(value === e ? null : e)}
            >
              <Text style={ep.emoji}>{e}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const ep = StyleSheet.create({
  scroll: { marginTop: 6 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2f2f2',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  btnSelected: {
    borderColor: '#3a7d44',
    backgroundColor: '#eaf4eb',
  },
  emoji: { fontSize: 24 },
  clearRow: {
    alignSelf: 'flex-start',
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#fde8e8',
  },
  clearText: { fontSize: 13, color: '#c0392b', fontWeight: '600' },
});
