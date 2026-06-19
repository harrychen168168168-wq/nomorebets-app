import { useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  children: React.ReactNode;
  style?: any;
};

export default function PageContainer({ children, style }: Props) {
  const { width } = useWindowDimensions();
  const maxWidth = 600;
  const isTablet = width > maxWidth;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#F8FAF7', alignItems: isTablet ? 'center' : 'stretch' }}>
      <View style={[{ width: isTablet ? maxWidth : '100%', flex: 1 }, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}
