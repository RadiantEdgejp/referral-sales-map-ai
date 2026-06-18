import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Home: undefined;
  AddPerson: undefined;
  PersonDetail: { personId: string };
  PreMeetingNav: { personId?: string; purpose?: string } | undefined;
  AfterMemo: { personId?: string; questions?: string[] } | undefined;
  LineCheck: { personId?: string; draft?: string } | undefined;
  EndOfDayCheck: undefined;
  CoachChat: { initialPrompt?: string } | undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;
