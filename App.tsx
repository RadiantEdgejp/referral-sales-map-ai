import * as Sentry from '@sentry/react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/auth/AuthContext';
import { initErrorMonitoring } from './src/lib/errorMonitoring';
import RootNavigator from './src/navigation/RootNavigator';
import { configureNotifications } from './src/notifications/notificationService';

const monitoringEnabled = initErrorMonitoring();
configureNotifications();

function App() {
  return (
    <AuthProvider>
      <RootNavigator />
      <StatusBar style="dark" />
    </AuthProvider>
  );
}

// Sentry.wrapはタッチイベント計測等のためのHOC。DSN未設定（未初期化）の
// ときは素のAppをそのまま使い、挙動への影響をゼロにする。
export default monitoringEnabled ? Sentry.wrap(App) : App;
