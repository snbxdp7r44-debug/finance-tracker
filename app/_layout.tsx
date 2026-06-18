import { Slot } from 'expo-router';
import { PaperProvider, MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { useColorScheme } from 'react-native';
import DatabaseProvider from '../src/database/DatabaseProvider';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? MD3DarkTheme : MD3LightTheme;

  return (
    <DatabaseProvider>
      <PaperProvider theme={theme}>
        <Slot />
      </PaperProvider>
    </DatabaseProvider>
  );
}
