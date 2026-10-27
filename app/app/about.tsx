import { StyleSheet, View } from 'react-native';
import { Screen } from '../src/components/Screen';
import { Card, Divider, Txt } from '../src/components/ui';
import { useApp } from '../src/store/AppProvider';
import { space } from '../src/theme/tokens';
import { rowRTL } from '../src/theme/rtl';
import { MAX_SCHEDULED } from '../src/lib/schedule';

export default function AboutScreen() {
  const { content } = useApp();

  return (
    <Screen>
      <Card style={styles.card}>
        <Txt variant="heading" bold center>
          حكمة
        </Txt>
        <Txt variant="small" muted center>
          مقولة لأحد العلماء وحديث في فضائل الأعمال، يصلانك بالتناوب في موعدٍ تختاره.
        </Txt>
      </Card>

      <Card style={styles.card}>
        <Txt variant="title" bold>
          منهج المحتوى
        </Txt>
        <Txt variant="small" muted>
          • الأحاديث مقصورة على صحيحَي البخاري ومسلم، وفي موضوع فضائل الأعمال وحده.
        </Txt>
        <Txt variant="small" muted>
          • المقولات منقولة من كتب أهل العلم، ومصدرها الافتراضي «موقع تراث».
        </Txt>
        <Txt variant="small" muted>
          • يُذكر تحت كل نص اسم الكتاب ورقم المجلد والصفحة كلما توفّرت.
        </Txt>
        <Txt variant="small" muted>
          • إضافة عالم أو مصدر جديد صلاحية الأدمن وحده.
        </Txt>
      </Card>

      <Card style={styles.card}>
        <Txt variant="title" bold>
          كيف يعمل التذكير
        </Txt>
        <Txt variant="small" muted>
          يجدول التطبيق حتى {MAX_SCHEDULED} موعداً مقدماً على جهازك، كل إشعارٍ يحمل نصّه معه.
          لا يوجد خادم إرسال، فلا تكلفة تشغيل، ويعمل التذكير حتى بلا إنترنت.
        </Txt>
      </Card>

      <Card style={styles.card}>
        <View style={styles.row}>
          <Txt variant="small" muted>
            المقولات
          </Txt>
          <Txt variant="small" medium>
            {content.quotes.length}
          </Txt>
        </View>
        <Divider />
        <View style={styles.row}>
          <Txt variant="small" muted>
            الأحاديث
          </Txt>
          <Txt variant="small" medium>
            {content.hadiths.length}
          </Txt>
        </View>
        <Divider />
        <View style={styles.row}>
          <Txt variant="small" muted>
            الإصدار
          </Txt>
          <Txt variant="small" medium>
            1.0.0
          </Txt>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, marginTop: space.md },
  row: { flexDirection: rowRTL, alignItems: 'center', justifyContent: 'space-between' },
});
