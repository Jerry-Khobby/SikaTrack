import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, ThemedText } from '@/components/atoms';
import { FontFamily, Spacing } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type BottomSheetProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned under the scrolling content, e.g. Reset and Save. */
  footer?: ReactNode;
  /** Fill most of the screen instead of fitting the content. */
  tall?: boolean;
};

/** A sheet that slides up over a dimmed screen. Mount it to open it; unmount it to close. */
export function BottomSheet({ title, onClose, children, footer, tall }: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={[styles.backdrop, { backgroundColor: theme.overlay }]} />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            tall ? { top: 56 + insets.top } : styles.fit,
            { backgroundColor: theme.surface },
          ]}>
          <View style={styles.top}>
            <View style={[styles.handle, { backgroundColor: theme.borderInput }]} />
            <View style={styles.header}>
              <ThemedText type="heading" accessibilityRole="header" style={styles.title}>
                {title}
              </ThemedText>
              <View style={styles.close}>
                <IconButton icon="close" accessibilityLabel="Close" onPress={onClose} />
              </View>
            </View>
          </View>
          <ScrollView
            style={tall ? styles.flex : undefined}
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer && (
            <View style={[styles.footer, { borderTopColor: theme.divider, paddingBottom: 20 + insets.bottom }]}>
              {footer}
            </View>
          )}
          {!footer && <View style={{ height: insets.bottom + Spacing.three }} />}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  flex: {
    flex: 1,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  fit: {
    maxHeight: '90%',
  },
  top: {
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
    marginTop: 10,
    marginBottom: 4,
  },
  title: {
    flex: 1,
    fontFamily: FontFamily.extraBold,
  },
  close: {
    marginRight: -10,
  },
  body: {
    paddingTop: 4,
    paddingHorizontal: 20,
    paddingBottom: Spacing.three,
    gap: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
  },
});
