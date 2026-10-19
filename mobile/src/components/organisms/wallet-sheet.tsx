import type { CountryCode } from 'libphonenumber-js/mobile';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, IconButton, ProviderBadge, ThemedText } from '@/components/atoms';
import { TextField } from '@/components/molecules';
import { FontFamily, Radius, Spacing } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
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
  const theme = useTheme();
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
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.backdrop} />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: Spacing.four + insets.bottom },
          ]}>
          <View style={[styles.handle, { backgroundColor: theme.borderInput }]} />
          <View style={styles.header}>
            <ThemedText type="heading" accessibilityRole="header" style={styles.title}>
              {editing ? 'Edit wallet' : 'Add a wallet'}
            </ThemedText>
            <View style={styles.close}>
              <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} />
            </View>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            <View>
              <ThemedText type="label" style={styles.fieldLabel}>
                Provider
              </ThemedText>
              <View style={styles.providers}>
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
                      style={[
                        styles.provider,
                        {
                          borderColor: selected ? theme.borderFocus : theme.borderInput,
                          borderWidth: selected ? 2 : 1.5,
                          backgroundColor: selected ? theme.surfaceSelected : theme.surface,
                        },
                        editing && !selected && styles.disabled,
                      ]}>
                      <ProviderBadge code={option.code} name={option.name} size={24} />
                      <Text
                        style={[
                          styles.providerName,
                          {
                            color: theme.text,
                            fontFamily: selected ? FontFamily.bold : FontFamily.semiBold,
                          },
                        ]}>
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
                <View style={styles.suggestions}>
                  <ThemedText type="fine" themeColor="textSecondary">
                    Is this you?
                  </ThemedText>
                  {nameSuggestions.map((name) => (
                    <Chip
                      key={name}
                      label={name}
                      selected={name === accountName}
                      onPress={() => setAccountName(name)}
                    />
                  ))}
                </View>
              )}
              <ThemedText type="fine" themeColor="textSecondary" style={styles.nameHint}>
                It must match your MoMo SMS exactly, so we can spot transfers between your own
                wallets.
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

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(27, 38, 49, 0.5)',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 18,
  },
  title: {
    flex: 1,
    fontFamily: FontFamily.extraBold,
  },
  close: {
    marginRight: -10,
  },
  form: {
    gap: 18,
  },
  fieldLabel: {
    marginBottom: Spacing.two,
  },
  providers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  provider: {
    flexGrow: 1,
    flexBasis: '45%',
    height: 48,
    borderRadius: Radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  providerName: {
    fontSize: 14,
  },
  disabled: {
    opacity: 0.4,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: 10,
  },
  nameHint: {
    marginTop: 6,
  },
});
