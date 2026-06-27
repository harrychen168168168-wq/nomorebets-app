import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  DEFAULT_REMINDER_SETTINGS,
  ensurePermission,
  getPermissionGranted,
  getReminderSettings,
  ReminderSettings,
  setReminderSettings,
} from '../notifications';

function formatHour(hour: number) {
  return String(hour).padStart(2, '0') + ':00';
}

export default function ReminderSettingsCard() {
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [granted, setGranted] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [paydayDayText, setPaydayDayText] = useState(String(DEFAULT_REMINDER_SETTINGS.paydayDay));

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [s, g] = await Promise.all([getReminderSettings(), getPermissionGranted()]);
        if (!active) return;
        setSettings(s);
        setPaydayDayText(String(s.paydayDay));
        setGranted(g);
        setLoaded(true);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  async function persist(next: ReminderSettings) {
    setSettings(next);
    await setReminderSettings(next);
    setGranted(await getPermissionGranted());
  }

  async function toggleMaster(value: boolean) {
    if (value) {
      const ok = await ensurePermission();
      if (!ok) {
        Alert.alert(
          '需要通知权限',
          '高风险时段提醒需要系统通知权限。请到 系统设置 › 通知 › NO MORE BETS 里打开“允许通知”。',
          Platform.OS === 'ios'
            ? [
                { text: '稍后', style: 'cancel' },
                { text: '去设置', onPress: () => Linking.openURL('app-settings:') },
              ]
            : [{ text: '知道了' }]
        );
        setGranted(false);
        return;
      }
    }
    await persist({ ...settings, enabled: value });
  }

  function shiftHour(field: 'nightlyHour' | 'weekendHour' | 'paydayHour', delta: number) {
    const next = (settings[field] + delta + 24) % 24;
    persist({ ...settings, [field]: next });
  }

  function commitPaydayDay() {
    const parsed = Math.min(31, Math.max(1, Math.round(Number(paydayDayText) || settings.paydayDay)));
    setPaydayDayText(String(parsed));
    persist({ ...settings, paydayDay: parsed });
  }

  if (!loaded) return null;

  const disabled = !settings.enabled;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>高风险时段提醒</Text>
          <Text style={styles.sub}>在最容易冲动的时刻，主动提醒你守住自己。提醒只在你的手机上，不会发给任何人。</Text>
        </View>
        <Switch value={settings.enabled} onValueChange={toggleMaster} trackColor={{ true: '#2E7D32', false: '#ccc' }} />
      </View>

      {settings.enabled && !granted && (
        <TouchableOpacity style={styles.permWarn} onPress={() => Linking.openURL('app-settings:')}>
          <Text style={styles.permWarnText}>系统通知权限未开启，提醒不会送达。点这里去“设置”打开通知。</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.row, disabled && styles.rowDisabled]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>🌙 每晚提醒</Text>
          <Text style={styles.rowSub}>一天里最容易冲动的夜晚，提醒你记录和承诺。</Text>
        </View>
        <View style={styles.rowRight}>
          {settings.nightlyEnabled && (
            <View style={styles.stepper}>
              <TouchableOpacity disabled={disabled} onPress={() => shiftHour('nightlyHour', -1)} style={styles.stepBtn}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
              <Text style={styles.stepValue}>{formatHour(settings.nightlyHour)}</Text>
              <TouchableOpacity disabled={disabled} onPress={() => shiftHour('nightlyHour', 1)} style={styles.stepBtn}><Text style={styles.stepBtnText}>＋</Text></TouchableOpacity>
            </View>
          )}
          <Switch disabled={disabled} value={settings.nightlyEnabled} onValueChange={(v) => persist({ ...settings, nightlyEnabled: v })} trackColor={{ true: '#2E7D32', false: '#ccc' }} />
        </View>
      </View>

      <View style={[styles.row, disabled && styles.rowDisabled]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>🛡️ 周末提醒</Text>
          <Text style={styles.rowSub}>周五、周六的高风险时段，提前给自己一个缓冲。</Text>
        </View>
        <View style={styles.rowRight}>
          {settings.weekendEnabled && (
            <View style={styles.stepper}>
              <TouchableOpacity disabled={disabled} onPress={() => shiftHour('weekendHour', -1)} style={styles.stepBtn}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
              <Text style={styles.stepValue}>{formatHour(settings.weekendHour)}</Text>
              <TouchableOpacity disabled={disabled} onPress={() => shiftHour('weekendHour', 1)} style={styles.stepBtn}><Text style={styles.stepBtnText}>＋</Text></TouchableOpacity>
            </View>
          )}
          <Switch disabled={disabled} value={settings.weekendEnabled} onValueChange={(v) => persist({ ...settings, weekendEnabled: v })} trackColor={{ true: '#2E7D32', false: '#ccc' }} />
        </View>
      </View>

      <View style={[styles.row, styles.rowLast, disabled && styles.rowDisabled]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>💰 发薪日提醒</Text>
          <Text style={styles.rowSub}>钱刚到手时冲动最大。设好每月发薪的日子。</Text>
          {settings.paydayEnabled && (
            <View style={styles.paydayConfig}>
              <Text style={styles.paydayLabel}>每月</Text>
              <TextInput
                editable={!disabled}
                style={styles.paydayInput}
                value={paydayDayText}
                onChangeText={setPaydayDayText}
                onBlur={commitPaydayDay}
                keyboardType="number-pad"
                maxLength={2}
              />
              <Text style={styles.paydayLabel}>号</Text>
              <View style={[styles.stepper, { marginLeft: 10 }]}>
                <TouchableOpacity disabled={disabled} onPress={() => shiftHour('paydayHour', -1)} style={styles.stepBtn}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
                <Text style={styles.stepValue}>{formatHour(settings.paydayHour)}</Text>
                <TouchableOpacity disabled={disabled} onPress={() => shiftHour('paydayHour', 1)} style={styles.stepBtn}><Text style={styles.stepBtnText}>＋</Text></TouchableOpacity>
              </View>
            </View>
          )}
        </View>
        <Switch disabled={disabled} value={settings.paydayEnabled} onValueChange={(v) => persist({ ...settings, paydayEnabled: v })} trackColor={{ true: '#2E7D32', false: '#ccc' }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 16, padding: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  sub: { fontSize: 13, color: '#888', marginTop: 4, lineHeight: 19 },
  permWarn: { backgroundColor: '#FFF8E7', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#F3D493' },
  permWarnText: { fontSize: 12, color: '#9A6A00', lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 10 },
  rowLast: { borderBottomWidth: 0 },
  rowDisabled: { opacity: 0.45 },
  rowTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  rowSub: { fontSize: 12, color: '#999', marginTop: 3, lineHeight: 17 },
  rowRight: { alignItems: 'flex-end', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAF7', borderRadius: 8, borderWidth: 1, borderColor: '#E6EFE6' },
  stepBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  stepBtnText: { fontSize: 16, color: '#2E7D32', fontWeight: 'bold' },
  stepValue: { fontSize: 13, color: '#333', fontWeight: 'bold', minWidth: 42, textAlign: 'center' },
  paydayConfig: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 },
  paydayLabel: { fontSize: 13, color: '#555' },
  paydayInput: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, fontSize: 14, color: '#333', minWidth: 46, textAlign: 'center' },
});
