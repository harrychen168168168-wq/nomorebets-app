import { Platform, ScrollView, ScrollViewProps, StyleSheet } from 'react-native';

export default function KeyboardAwareScrollView({ contentContainerStyle, keyboardDismissMode, keyboardShouldPersistTaps, ...props }: ScrollViewProps) {
  return (
    <ScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps ?? 'handled'}
      keyboardDismissMode={keyboardDismissMode ?? (Platform.OS === 'ios' ? 'interactive' : 'on-drag')}
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, contentContainerStyle]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 160,
  },
});
