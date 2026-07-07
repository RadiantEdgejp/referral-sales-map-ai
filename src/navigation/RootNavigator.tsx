import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AddPersonScreen from '../screens/AddPersonScreen';
import CoachChatScreen from '../screens/CoachChatScreen';
import HomeScreen from '../screens/HomeScreen';
import PersonDetailScreen from '../screens/PersonDetailScreen';
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
        <Stack.Screen name="CoachChat" component={CoachChatScreen} options={{ title: '営業コーチ' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
