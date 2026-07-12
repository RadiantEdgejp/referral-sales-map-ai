import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { LegalDocKey } from '../legal/legalContent';

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  AddPerson: undefined;
  PersonDetail: { personId: string };
  CoachChat: { initialPrompt?: string } | undefined;
  Settings: undefined;
  LegalDoc: { doc: LegalDocKey };
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
  LegalDoc: { doc: LegalDocKey };
};

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;
