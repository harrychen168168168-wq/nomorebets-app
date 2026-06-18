import { useWindowDimensions, View } from 'react-native';

type Props = {
  children: React.ReactNode;
  style?: any;
};

export default function PageContainer({ children, style }: Props) {
  const { width } = useWindowDimensions();
  const maxWidth = 600;
  const isTablet = width > maxWidth;

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAF7', alignItems: isTablet ? 'center' : 'stretch' }}>
      <View style={[{ width: isTablet ? maxWidth : '100%', flex: 1 }, style]}>
        {children}
      </View>
    </View>
  );
}