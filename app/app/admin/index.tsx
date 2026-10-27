import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { Banner, Button, Card, Chip, Field, Txt } from '../../src/components/ui';
import { useAuth } from '../../src/store/AuthProvider';
import { useApp } from '../../src/store/AppProvider';
import { space } from '../../src/theme/tokens';
import { rowRTL } from '../../src/theme/rtl';
import {
  createHadith,
  createQuote,
  createScholar,
  createSource,
  slugify,
} from '../../src/lib/admin';
import type { HadithCollection } from '../../src/data/types';

type Form = 'hadith' | 'quote' | 'scholar' | 'source';

const FORMS: { key: Form; label: string }[] = [
  { key: 'hadith', label: 'حديث' },
  { key: 'quote', label: 'مقولة' },
  { key: 'scholar', label: 'عالم' },
  { key: 'source', label: 'مصدر' },
];

function num(value: string): number | null {
  const n = Number(value.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function AdminScreen() {
  const { remoteEnabled, loading, session, profile, isAdmin, signIn, signOut } = useAuth();
  const { content, refresh } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Form>('hadith');

  // حقول مشتركة
  const [text, setText] = useState('');
  const [book, setBook] = useState('');
  const [volume, setVolume] = useState('');
  const [page, setPage] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [extra, setExtra] = useState('');
  const [number, setNumber] = useState('');
  const [collection, setCollection] = useState<HadithCollection>('bukhari');
  const [scholarId, setScholarId] = useState<string | null>(content.scholars[0]?.id ?? null);
  const [sourceId, setSourceId] = useState<string | null>(
    content.sources.find((s) => s.is_default)?.id ?? content.sources[0]?.id ?? null,
  );

  const reset = () => {
    setText('');
    setBook('');
    setVolume('');
    setPage('');
    setName('');
    setSlug('');
    setExtra('');
    setNumber('');
  };

  const onSignIn = useCallback(async () => {
    setBusy(true);
    try {
      await signIn(email, password);
      setPassword('');
    } catch (error) {
      Alert.alert('تعذّر الدخول', error instanceof Error ? error.message : 'خطأ غير معروف');
    } finally {
      setBusy(false);
    }
  }, [email, password, signIn]);

  const onSubmit = useCallback(async () => {
    setBusy(true);
    try {
      if (form === 'hadith') {
        if (!sourceId) throw new Error('لا يوجد مصدر متاح.');
        await createHadith({
          collection,
          text,
          narrator: extra,
          chapter: book,
          number: num(number),
          volume: num(volume),
          page: num(page),
          source_id: sourceId,
          publish: true,
        });
      } else if (form === 'quote') {
        if (!scholarId || !sourceId) throw new Error('اختر العالم والمصدر.');
        await createQuote({
          scholar_id: scholarId,
          source_id: sourceId,
          text,
          book,
          volume: num(volume),
          page: num(page),
          publish: true,
        });
      } else if (form === 'scholar') {
        await createScholar({ name, slug: slug || slugify(name), bio: extra });
      } else {
        await createSource({
          name,
          slug: slug || slugify(name),
          kind: 'external',
          base_url: extra,
        });
      }
      reset();
      await refresh();
      Alert.alert('تمت الإضافة', 'حُفظ العنصر وسيظهر بعد المزامنة.');
    } catch (error) {
      Alert.alert('تعذّر الحفظ', error instanceof Error ? error.message : 'خطأ غير معروف');
    } finally {
      setBusy(false);
    }
  }, [form, collection, text, extra, book, number, volume, page, sourceId, scholarId, name, slug, refresh]);

  if (!remoteEnabled) {
    return (
      <Screen>
        <View style={styles.block}>
          <Banner tone="warn" icon="cloud-offline-outline">
            لوحة الأدمن تحتاج اتصالاً بـ Supabase. انسخ ‎.env.example‎ إلى ‎.env‎ واملأ العنوان والمفتاح،
            ثم أعد تشغيل التطبيق.
          </Banner>
          <Txt variant="small" muted>
            التطبيق يعمل كاملاً بدونها اعتماداً على المحتوى المدمج.
          </Txt>
        </View>
      </Screen>
    );
  }

  if (loading) return <Screen><View style={styles.block} /></Screen>;

  if (!session) {
    return (
      <Screen>
        <Card style={styles.block}>
          <Txt variant="title" bold>
            دخول الأدمن
          </Txt>
          <Field
            label="البريد الإلكتروني"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            dir="ltr"
          />
          <Field
            label="كلمة المرور"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            dir="ltr"
          />
          <Button label="دخول" onPress={onSignIn} loading={busy} full />
        </Card>
      </Screen>
    );
  }

  if (!isAdmin) {
    return (
      <Screen>
        <View style={styles.block}>
          <Banner tone="error" icon="lock-closed-outline">
            هذا الحساب ليس أدمن. إضافة العلماء والمصادر والمحتوى مقصورة على الأدمن،
            ويفرضها الخادم عبر سياسات RLS.
          </Banner>
          <Button label="تسجيل الخروج" onPress={signOut} variant="ghost" full />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Txt variant="small" muted style={styles.grow}>
          {profile?.email}
        </Txt>
        <Button label="خروج" onPress={signOut} variant="ghost" />
      </View>

      <View style={styles.chips}>
        {FORMS.map((f) => (
          <Chip key={f.key} label={f.label} selected={form === f.key} onPress={() => setForm(f.key)} />
        ))}
      </View>

      <Card style={styles.block}>
        {form === 'hadith' ? (
          <>
            <Banner icon="shield-checkmark-outline">
              الأحاديث مقصورة على الصحيحين وفي فضائل الأعمال.
            </Banner>
            <View style={styles.chips}>
              {(['bukhari', 'muslim'] as HadithCollection[]).map((c) => (
                <Chip
                  key={c}
                  label={c === 'bukhari' ? 'صحيح البخاري' : 'صحيح مسلم'}
                  selected={collection === c}
                  onPress={() => setCollection(c)}
                />
              ))}
            </View>
            <Field label="متن الحديث" value={text} onChangeText={setText} multiline />
            <Field label="الراوي" value={extra} onChangeText={setExtra} placeholder="أبو هريرة رضي الله عنه" />
            <Field label="الكتاب داخل الصحيح" value={book} onChangeText={setBook} placeholder="كتاب الإيمان" />
            <Field label="رقم الحديث" value={number} onChangeText={setNumber} keyboardType="number-pad" />
          </>
        ) : null}

        {form === 'quote' ? (
          <>
            <View style={styles.chips}>
              {content.scholars.map((s) => (
                <Chip key={s.id} label={s.name} selected={scholarId === s.id} onPress={() => setScholarId(s.id)} />
              ))}
            </View>
            <Field label="نص المقولة" value={text} onChangeText={setText} multiline />
            <Field label="اسم الكتاب" value={book} onChangeText={setBook} placeholder="مدارج السالكين" />
          </>
        ) : null}

        {form === 'hadith' || form === 'quote' ? (
          <>
            <View style={styles.row}>
              <View style={styles.grow}>
                <Field label="المجلد" value={volume} onChangeText={setVolume} keyboardType="number-pad" />
              </View>
              <View style={styles.grow}>
                <Field label="الصفحة" value={page} onChangeText={setPage} keyboardType="number-pad" />
              </View>
            </View>
            <View style={styles.chips}>
              {content.sources.map((s) => (
                <Chip key={s.id} label={s.name} selected={sourceId === s.id} onPress={() => setSourceId(s.id)} />
              ))}
            </View>
          </>
        ) : null}

        {form === 'scholar' ? (
          <>
            <Field label="اسم العالم" value={name} onChangeText={setName} placeholder="ابن رجب الحنبلي" />
            <Field label="المعرّف (slug)" value={slug} onChangeText={setSlug} placeholder="ibn-rajab" dir="ltr" autoCapitalize="none" />
            <Field label="نبذة" value={extra} onChangeText={setExtra} multiline />
          </>
        ) : null}

        {form === 'source' ? (
          <>
            <Banner tone="warn" icon="alert-circle-outline">
              «موقع تراث» هو المصدر المعتمد. أضف غيره عند الحاجة فقط.
            </Banner>
            <Field label="اسم المصدر" value={name} onChangeText={setName} />
            <Field label="المعرّف (slug)" value={slug} onChangeText={setSlug} dir="ltr" autoCapitalize="none" />
            <Field label="الرابط" value={extra} onChangeText={setExtra} keyboardType="url" dir="ltr" autoCapitalize="none" />
          </>
        ) : null}

        <Button label="حفظ ونشر" onPress={onSubmit} loading={busy} icon="checkmark-circle-outline" full />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md, marginTop: space.md },
  headerRow: { flexDirection: rowRTL, alignItems: 'center', gap: space.sm, marginTop: space.md },
  chips: { flexDirection: rowRTL, flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: rowRTL, gap: space.md },
  grow: { flex: 1 },
});
