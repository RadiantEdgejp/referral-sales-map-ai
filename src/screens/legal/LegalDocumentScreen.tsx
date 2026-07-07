import { useLayoutEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { CONTACT_EMAIL, LEGAL_DOCUMENTS, type LegalDocKey } from '../../legal/legalContent';

type LegalRouteParams = { doc: LegalDocKey };

/**
 * Issue #14: 利用規約 / プライバシーポリシー / AI利用上の注意 を表示する共通画面。
 * 認証前（サインアップ画面から）と認証後（設定画面から）の両スタックに登録される。
 */
export default function LegalDocumentScreen() {
  const route = useRoute<RouteProp<{ LegalDoc: LegalRouteParams }, 'LegalDoc'>>();
  const navigation = useNavigation();
  const doc = LEGAL_DOCUMENTS[route.params?.doc ?? 'terms'];

  useLayoutEffect(() => {
    navigation.setOptions({ title: doc.title });
  }, [navigation, doc.title]);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container} testID="legal-doc">
      <Text style={styles.title}>{doc.title}</Text>
      <Text style={styles.updatedAt}>最終更新日: {doc.updatedAt}</Text>
      <Text style={styles.intro}>{doc.intro}</Text>

      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}

      <View style={styles.contactBox}>
        <Text style={styles.contactLabel}>お問い合わせ・データ削除のご依頼</Text>
        <Text style={styles.contactEmail}>{CONTACT_EMAIL}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 20,
    paddingBottom: 48,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '900',
  },
  updatedAt: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 4,
  },
  intro: {
    color: '#334155',
    lineHeight: 22,
    marginTop: 16,
  },
  section: {
    marginTop: 20,
  },
  heading: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 15,
    marginBottom: 6,
  },
  body: {
    color: '#334155',
    lineHeight: 22,
  },
  contactBox: {
    marginTop: 28,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 14,
  },
  contactLabel: {
    color: '#1D4ED8',
    fontWeight: '900',
    fontSize: 13,
  },
  contactEmail: {
    color: '#1D4ED8',
    fontWeight: '700',
    marginTop: 4,
  },
});
