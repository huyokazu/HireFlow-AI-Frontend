import { useEffect, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideOutLeft } from 'react-native-reanimated';

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** Slide-in panel for the sidebar on screens too narrow to show it permanently. */
export function MobileDrawer({ open, onClose, children }: MobileDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [open, onClose]);

  // The container stays mounted so the backdrop and panel can play their exit animations.
  return (
    <View style={styles.container}>
      {open && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
      {open && (
        <Animated.View
          entering={SlideInLeft.duration(260)}
          exiting={SlideOutLeft.duration(220)}
          style={styles.panel}
        >
          {children}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'box-none',
    zIndex: 50,
  },
  backdrop: {
    backgroundColor: 'rgba(2, 6, 23, 0.4)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 288,
    maxWidth: '85%',
    backgroundColor: '#FFFFFF',
  },
});
