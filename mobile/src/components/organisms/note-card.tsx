import { StyleSheet, TextInput } from 'react-native';

import { Card, ThemedText } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type NoteCardProps = {
  value: string;
  onChangeText: (text: string) => void;
  /** Saves when the field loses focus. */
  onBlur: () => void;
};

/** An inline "Add a note" field that saves when you leave it. */
export function NoteCard({ value, onChangeText, onBlur }: NoteCardProps) {
  const theme = useTheme();

  return (
    <Card radius={18} padding={0} style={styles.card}>
      <ThemedText type="fine" themeColor="textSecondary" style={styles.label}>
        Note
      </ThemedText>
      <TextInput
        accessibilityLabel="Note"
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder="Add a note"
        placeholderTextColor={theme.textSecondary}
        selectionColor={theme.link}
        returnKeyType="done"
        maxLength={280}
        style={[styles.input, { color: theme.text }]}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  label: {
    marginBottom: 6,
  },
  input: {
    padding: 0,
    minHeight: 24,
    fontFamily: FontFamily.regular,
    fontSize: 15,
  },
});
