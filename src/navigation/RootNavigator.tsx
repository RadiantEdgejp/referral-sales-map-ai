import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LogOut, Settings as SettingsIcon } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import AddPersonScreen from '../screens/AddPersonScreen';
import CoachChatScreen from '../screens/CoachChatScreen';
import HomeScreen from '../screens/HomeScreen';
import PersonDetailScreen from '../screens/PersonDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LegalDocumentScreen from '../screens/legal/LegalDocumentScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import UpdatePasswordScreen from '../screens/auth/UpdatePasswordScreen';
import type { AuthStackParamList, RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: '#F8FAFC' },
  headerTitleStyle: { color: '#0F172A', fontWeight: '800' },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: '#F8FAFC' },
} as const;

/** Header settings button shown on Home (Issue #14: settings / legal pages). */
function SettingsButton() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <Pressable
      onPress={() => navigation.navigate('Settings')}
      style={logoutStyles.button}
      testID="settings-button"
      accessibilityLabel="設定"
    >
      <SettingsIcon color="#153E75" size={16} />
    </Pressable>
  );
}

/** Header logout button shown on Home (Issue #10: logout feature). */
function LogoutButton() {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  const confirmAndSignOut = async () => {
    if (busy) {
      return;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.confirm('ログアウトしますか？')) {
      return;
    }
    setBusy(true);
    try {
      await signOut();
      // 成功時は onAuthStateChange 経由で自動的にログイン画面へ切り替わる。
    } catch (err) {
      console.warn(err);
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={confirmAndSignOut}
      disabled={busy}
      style={[logoutStyles.button, busy && logoutStyles.disabled]}
      testID="logout-button"
      accessibilityLabel="ログアウト"
    >
      <LogOut color="#153E75" size={16} />
      <Text style={logoutStyles.text}>ログアウト</Text>
    </Pressable>
  );
}

export default function RootNavigator() {
  const { initializing, session, profile, profileLoading, profileError, reloadProfile, passwordRecovery } = useAuth();

  return (
    <NavigationContainer>
      {initializing || (session && profileLoading) ? (
        // セッション復元中のスプラッシュ。
        <View style={logoutStyles.splash}>
          <ActivityIndicator size="large" color="#153E75" />
        </View>
      ) : passwordRecovery ? (
        // パスワード再設定リンクから戻ってきた状態。
        <AuthStack.Navigator screenOptions={screenOptions}>
          <AuthStack.Screen
            name="Login"
            component={UpdatePasswordScreen}
            options={{ title: 'パスワード再設定' }}
          />
        </AuthStack.Navigator>
      ) : session && profileError ? (
        <View style={logoutStyles.splash}>
          <Text style={logoutStyles.profileError}>{profileError}</Text>
          <Pressable style={logoutStyles.retryButton} onPress={() => void reloadProfile()}>
            <Text style={logoutStyles.retryText}>再試行</Text>
          </Pressable>
        </View>
      ) : session && profile && !profile.onboardingCompleted ? (
        <Stack.Navigator screenOptions={screenOptions}>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ title: '最初の設定', headerBackVisible: false }} />
        </Stack.Navigator>
      ) : session ? (
        <Stack.Navigator screenOptions={screenOptions}>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{
              title: '紹介営業マップAI',
              headerRight: () => (
                <View style={logoutStyles.headerRight}>
                  <SettingsButton />
                  <LogoutButton />
                </View>
              ),
            }}
          />
          <Stack.Screen name="AddPerson" component={AddPersonScreen} options={{ title: '人物追加' }} />
          <Stack.Screen name="PersonDetail" component={PersonDetailScreen} options={{ title: '人物詳細' }} />
          <Stack.Screen name="CoachChat" component={CoachChatScreen} options={{ title: '営業コーチ' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '設定' }} />
          <Stack.Screen name="LegalDoc" component={LegalDocumentScreen} options={{ title: '規約・ポリシー' }} />
        </Stack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={screenOptions}>
          <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: 'ログイン' }} />
          <AuthStack.Screen name="SignUp" component={SignUpScreen} options={{ title: '新規登録' }} />
          <AuthStack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            options={{ title: 'パスワードリセット' }}
          />
          <AuthStack.Screen
            name="LegalDoc"
            component={LegalDocumentScreen}
            options={{ title: '規約・ポリシー' }}
          />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}

const logoutStyles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: '#153E75',
    fontWeight: '800',
    fontSize: 12,
  },
  profileError: { color: '#B91C1C', fontWeight: '800', marginHorizontal: 24, textAlign: 'center' },
  retryButton: { backgroundColor: '#153E75', borderRadius: 8, marginTop: 16, paddingHorizontal: 20, paddingVertical: 12 },
  retryText: { color: '#FFFFFF', fontWeight: '900' },
});
