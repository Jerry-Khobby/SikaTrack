import type { CountryCode } from 'libphonenumber-js/mobile';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, IconButton, ProviderBadge, ThemedText } from '@/components/atoms';
import { TextField } from '@/components/molecules';
import { findCountry } from '@/utils/countries';
import { formatNationalNumber, formatPhoneInput, parsePhoneNumber } from '@/utils/phone';

export type WalletFormValues = {
  provider: string;
  /** E.164. */
  phoneNumber: string;
  accountName: string;
  label: string | null;
};

export type WalletSheetProps = {
  /** `add` asks for everything; `edit` only lets the account name and label change. */
  mode: 'add' | 'edit';
  /** The providers a wallet can be added for. */
  providers: { code: string; name: string }[];
  initial: { provider: string; phoneNumber: string; accountName: string; label: string };
  /** The country wallet numbers belong to, for formatting and checking them. */
  country: CountryCode;
  /** Account-holder names found in the MoMo SMS, offered as "Is this you?" chips. */
  nameSuggestions: string[];
  /** Saves the wallet; throw an Error with a message to show it in the sheet. */
  onSave: (values: WalletFormValues) => Promise<void>;
  onClose: () => void;
};

/** The add-a-wallet bottom sheet (S27). Mount it to open it; unmount it to close. */
export function WalletSheet({
  mode,
  providers,
  initial,
  country,
  nameSuggestions,
  onSave,
  onClose,
}: WalletSheetProps) {
  const insets = useSafeAreaInsets();
  const editing = mode === 'edit';
  const [provider, setProvider] = useState(initial.provider);
  const [phoneText, setPhoneText] = useState(
    initial.phoneNumber ? formatNationalNumber(initial.phoneNumber) : '',
  );
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [accountName, setAccountName] = useState(initial.accountName);
  const [label, setLabel] = useState(initial.label);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const phoneNumber = parsePhoneNumber(phoneText, country);
  const phoneError =
    phoneTouched && phoneText && !phoneNumber
      ? `Enter a mobile number from ${findCountry(country)?.name ?? 'your country'}.`
      : undefined;
  const canSave = Boolean(provider && phoneNumber && accountName.trim());

  const save = async () => {
    if (!phoneNumber) return;
    setSaving(true);
    setError(undefined);
    try {
      await onSave({
        provider,
        phoneNumber,
        accountName: accountName.trim(),
        label: label.trim() || null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end">
        <Pressable accessibilityLabel="Close" onPress={onClose} className="absolute inset-0 bg-overlay" />
        <View
          accessibilityViewIsModal
          className="max-h-[92%] rounded-t-3xl bg-surface px-5 pt-2.5"
          style={{ paddingBottom: 24 + insets.bottom }}>
          <View className="h-1 w-10 self-center rounded-sm bg-line-input" />
          <View className="mb-[18px] mt-3 flex-row items-center">
            <ThemedText type="none" accessibilityRole="header" className="flex-1 font-sans-extrabold text-[20px] leading-[26px]">
              {editing ? 'Edit wallet' : 'Add a wallet'}
            </ThemedText>
            <View className="-mr-2.5">
              <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} />
            </View>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-[18px]">
            <View>
              <ThemedText type="label" className="mb-2">
                Provider
              </ThemedText>
              <View className="flex-row flex-wrap gap-2">
                {providers.map((option) => {
                  const selected = option.code === provider;
                  return (
                    <Pressable
                      key={option.code}
                      accessibilityRole="radio"
                      accessibilityLabel={option.name}
                      accessibilityState={{ checked: selected, disabled: editing }}
                      disabled={editing}
                      onPress={() => setProvider(option.code)}
                      className={`h-12 grow basis-[45%] flex-row items-center justify-center gap-2 rounded-sm ${
                        selected ? 'border-2 border-line-focus bg-surface-selected' : 'border-[1.5px] border-line-input bg-surface'
                      } ${editing && !selected ? 'opacity-40' : ''}`}>
                      <ProviderBadge code={option.code} name={option.name} size={24} />
                      <Text className={`text-[14px] text-content ${selected ? 'font-sans-bold' : 'font-sans-semibold'}`}>
                        {option.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <TextField
              label="Phone number"
              value={phoneText}
              onChangeText={(text) => setPhoneText(formatPhoneInput(text, phoneText, country))}
              onBlur={() => setPhoneTouched(true)}
              error={phoneError}
              editable={!editing}
              keyboardType="phone-pad"
              autoComplete="tel"
            />

            <View>
              <TextField
                label="Name on the account"
                value={accountName}
                onChangeText={setAccountName}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {nameSuggestions.length > 0 && (
                <View className="mt-2.5 flex-row flex-wrap items-center gap-2">
                  <ThemedText type="fine" themeColor="textSecondary">
                    Is this you?
                  </ThemedText>
                  {nameSuggestions.map((name) => (
                    <Chip key={name} label={name} selected={name === accountName} onPress={() => setAccountName(name)} />
                  ))}
                </View>
              )}
              <ThemedText type="fine" themeColor="textSecondary" className="mt-1.5">
                It must match your MoMo SMS exactly, so we can spot transfers between your own wallets.
              </ThemedText>
            </View>

            <TextField
              label="Label"
              labelNote="(optional)"
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. Main MoMo"
            />

            {error && (
              <ThemedText type="caption" themeColor="error" accessibilityLiveRegion="polite">
                {error}
              </ThemedText>
            )}
            <Button label="Save" onPress={save} disabled={!canSave} loading={saving} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
