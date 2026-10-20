import { useState } from 'react';

import { Button } from '@/components/atoms';
import { TextField } from '@/components/molecules';

import { BottomSheet } from './bottom-sheet';

export type TextPromptSheetProps = {
  title: string;
  label: string;
  initial: string;
  saveLabel?: string;
  /** Throw an Error with a message to show it under the field. */
  onSave: (value: string) => Promise<void>;
  onClose: () => void;
};

/** A sheet with one text field, e.g. renaming a recurring payment. */
export function TextPromptSheet({ title, label, initial, saveLabel = 'Save', onSave, onClose }: TextPromptSheetProps) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await onSave(value.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      title={title}
      onClose={onClose}
      footer={<Button label={saveLabel} onPress={save} disabled={!value.trim()} loading={saving} />}>
      <TextField label={label} value={value} onChangeText={setValue} error={error} autoFocus />
    </BottomSheet>
  );
}
