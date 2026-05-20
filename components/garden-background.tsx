import { ImageBackground, StyleSheet, View, type ViewProps } from 'react-native';

type Variant = 'auth' | 'app';

type Props = ViewProps & { variant?: Variant };

const overlays: Record<Variant, string> = {
  auth: 'rgba(255, 252, 245, 0.87)',
  app:  'rgba(237, 247, 237, 0.88)',
};

export function GardenBackground({ variant = 'app', style, children, ...rest }: Props) {
  return (
    <ImageBackground
      source={require('@/assets/images/sprout-about.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={[styles.overlay, { backgroundColor: overlays[variant] }, style]} {...rest}>
        {children}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { flex: 1 },
});
