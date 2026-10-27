import type React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: readonly Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

/** غلاف موحّد للشاشات: خلفية، حواف آمنة، وتمرير اختياري. */
export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ['top'],
  contentStyle,
  refreshControl,
}: Props) {
  const { colors } = useTheme();
  const inner: StyleProp<ViewStyle> = [padded && styles.padded, contentStyle];

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]} edges={edges}>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, inner]}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { paddingBottom: space.xxxl },
  padded: { paddingHorizontal: space.lg },
});
