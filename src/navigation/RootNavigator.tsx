import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AddPersonScreen from '../screens/AddPersonScreen';
import AfterMemoScreen from '../screens/AfterMemoScreen';
import CoachChatScreen from '../screens/CoachChatScreen';
import EndOfDayCheckScreen from '../screens/EndOfDayCheckScreen';
import HomeScreen from '../screens/HomeScreen';
import LineCheckScreen from '../screens/LineCheckScreen';
import PersonDetailScreen from '../screens/PersonDetailScreen';
import PreMeetingNavScreen from '../screens/PreMeetingNavScreen';
import type { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#F8FAFC' },
          headerTitleStyle: { color: '#0F172A', fontWeight: '800' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#F8FAFC' },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: '紹介営業マップAI' }} />
        <Stack.Screen name="AddPerson" component={AddPersonScreen} options={{ title: '人物追加' }} />
        <Stack.Screen name="PersonDetail" component={PersonDetailScreen} options={{ title: '人物詳細' }} />
        <Stack.Screen name="PreMeetingNav" component={PreMeetingNavScreen} options={{ title: '予定前ナビ' }} />
        <Stack.Screen name="AfterMemo" component={AfterMemoScreen} options={{ title: '後メモ' }} />
        <Stack.Screen name="LineCheck" component={LineCheckScreen} options={{ title: 'LINEチェック' }} />
        <Stack.Screen name="EndOfDayCheck" component={EndOfDayCheckScreen} options={{ title: '終業後チェック' }} />
        <Stack.Screen name="CoachChat" component={CoachChatScreen} options={{ title: '営業コーチ' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
