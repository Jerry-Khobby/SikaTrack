import { TextInput } from 'react-native';

import { Card, ThemedText } from '@/components/atoms';
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
    <Card radius={18} padded={false} className="px-4 py-[14px]">
      <ThemedText type="fine" themeColor="textSecondary" className="mb-1.5">
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
        className="min-h-[24px] p-0 font-sans text-[15px] text-content"
      />
    </Card>
  );
}
