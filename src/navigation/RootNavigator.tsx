import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LogOut } from 'lucide-react-native';
import { useAuth } from '../auth/AuthContext';
import AddPersonScreen from '../screens/AddPersonScreen';
import AfterMemoScreen from '../screens/AfterMemoScreen';
import CoachChatScreen from '../screens/CoachChatScreen';
import EndOfDayCheckScreen from '../screens/EndOfDayCheckScreen';
import HomeScreen from '../screens/HomeScreen';
import LineCheckScreen from '../screens/LineCheckScreen';
import PersonDetailScreen from '../screens/PersonDetailScreen';
import PreMeetingNavScreen from '../screens/PreMeetingNavScreen';
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
  const { initializing, session, passwordRecovery } = useAuth();

  return (
    <NavigationContainer>
      {initializing ? (
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
      ) : session ? (
        <Stack.Navigator screenOptions={screenOptions}>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: '紹介営業マップAI', headerRight: () => <LogoutButton /> }}
          />
          <Stack.Screen name="AddPerson" component={AddPersonScreen} options={{ title: '人物追加' }} />
          <Stack.Screen name="PersonDetail" component={PersonDetailScreen} options={{ title: '人物詳細' }} />
          <Stack.Screen name="PreMeetingNav" component={PreMeetingNavScreen} options={{ title: '予定前ナビ' }} />
          <Stack.Screen name="AfterMemo" component={AfterMemoScreen} options={{ title: '後メモ' }} />
          <Stack.Screen name="LineCheck" component={LineCheckScreen} options={{ title: 'LINEチェック' }} />
          <Stack.Screen name="EndOfDayCheck" component={EndOfDayCheckScreen} options={{ title: '終業後チェック' }} />
          <Stack.Screen name="CoachChat" component={CoachChatScreen} options={{ title: '営業コーチ' }} />
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
});
