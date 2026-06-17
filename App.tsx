import { StatusBar } from 'expo-status-bar';
import RootNavigator from './src/navigation/RootNavigator';
import { configureNotifications } from './src/notifications/notificationService';

configureNotifications();

export default function App() {
  return (
    <>
      <RootNavigator />
      <StatusBar style="dark" />
    </>
  );
}
