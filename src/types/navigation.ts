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

/** Screens shown while the user is signed out (Issue #10). */
export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ResetPassword: undefined;
};

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;
