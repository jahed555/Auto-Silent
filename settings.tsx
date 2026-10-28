import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { Bell, BellOff, MapPin, Shield, Info, ChevronRight, Check, AlertTriangle } from 'lucide-react-native';
import {
  getGeofenceSettings,
  saveGeofenceSettings,
  GeofenceSettings,
} from '@/lib/silent-state';
import { requestLocationPermissions, locationPermissionsStatus, syncGeofences } from '@/lib/geofence';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/lib/theme';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<GeofenceSettings | null>(null);
  const [fgPerm, setFgPerm] = useState<Location.LocationPermissionResponse | null>(null);
  const [bgPerm, setBgPerm] = useState<Location.LocationPermissionResponse | null>(null);
  const [permLoading, setPermLoading] = useState(false);

  const loadSettings = useCallback(async () => {
    const s = await getGeofenceSettings();
    setSettings(s);
    const fg = await Location.getForegroundPermissionsAsync();
    setFgPerm(fg);
    if (Platform.OS !== 'web') {
      try {
        const bg = await Location.getBackgroundPermissionsAsync();
        setBgPerm(bg);
      } catch {
        setBgPerm(null);
      }
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const toggleSetting = (key: keyof GeofenceSettings) => {
    if (!settings) return;
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    saveGeofenceSettings(updated);
    if (key === 'autoSilentEnabled') {
      syncGeofences();
    }
  };

  const handleRequestPermissions = async () => {
    setPermLoading(true);
    await requestLocationPermissions();
    const fg = await Location.getForegroundPermissionsAsync();
    setFgPerm(fg);
    try {
      const bg = await Location.getBackgroundPermissionsAsync();
      setBgPerm(bg);
    } catch {
      // web
    }
    setPermLoading(false);
  };

  if (!settings) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary[600]} />
      </SafeAreaView>
    );
  }

  const perms = locationPermissionsStatus(fgPerm, bgPerm);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>Manage auto-silent and geofence behavior</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Geofence Behavior</Text>
        <View style={styles.card}>
          <SettingRow
            icon={<BellOff size={20} color={COLORS.primary[600]} strokeWidth={2} />}
            title="Auto-Silent"
            subtitle="Mute phone when entering a mosque geofence"
            value={settings.autoSilentEnabled}
            onToggle={() => toggleSetting('autoSilentEnabled')}
          />
          <Divider />
          <SettingRow
            icon={<MapPin size={20} color={COLORS.primary[600]} strokeWidth={2} />}
            title="Proximity Check"
            subtitle="Periodically check distance to mosques (web fallback)"
            value={settings.proximityCheckEnabled}
            onToggle={() => toggleSetting('proximityCheckEnabled')}
          />
          <Divider />
          <SettingRow
            icon={<Bell size={20} color={COLORS.primary[600]} strokeWidth={2} />}
            title="Notifications"
            subtitle="Alert when entering or leaving a geofence"
            value={settings.notificationsEnabled}
            onToggle={() => toggleSetting('notificationsEnabled')}
          />
        </View>

        <Text style={styles.sectionTitle}>Permissions</Text>
        <View style={styles.card}>
          <View style={styles.permissionRow}>
            <View style={styles.permissionInfo}>
              <Shield size={20} color={COLORS.primary[600]} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={styles.permissionTitle}>Location Access</Text>
                <Text style={styles.permissionStatus}>
                  Foreground: {perms.foregroundGranted ? 'Granted' : 'Not granted'}
                  {Platform.OS !== 'web' && ` · Background: ${perms.backgroundGranted ? 'Granted' : 'Not granted'}`}
                </Text>
              </View>
            </View>
            {perms.canMonitor ? (
              <View style={styles.permBadge}>
                <Check size={14} color={COLORS.white} strokeWidth={2.5} />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.permButton}
                onPress={handleRequestPermissions}
                disabled={permLoading}
                activeOpacity={0.85}>
                {permLoading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.permButtonText}>Grant</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          {!perms.canMonitor && (
            <View style={styles.warningRow}>
              <AlertTriangle size={16} color={COLORS.warning} strokeWidth={2} />
              <Text style={styles.warningText}>
                Background location is required for auto-silent to work when the app is closed.
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.aboutRow}
            onPress={() =>
              Alert.alert(
                'How It Works',
                '1. Capture a photo of a mosque.\n2. The app saves the GPS location as a geofence.\n3. When you enter the geofence radius, your phone automatically goes silent.\n4. When you leave, your previous sound setting is restored.'
              )
            }
            activeOpacity={0.7}>
            <Info size={20} color={COLORS.primary[600]} strokeWidth={2} />
            <Text style={styles.aboutText}>How auto-silent works</Text>
            <ChevronRight size={18} color={COLORS.neutral[400]} strokeWidth={2} />
          </TouchableOpacity>

          <Divider />

          {/* Developer Credits */}
          <View style={{ paddingVertical: SPACING.sm, alignItems: 'center', marginTop: 8 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: COLORS.neutral[900] }}>Developed by Jahed</Text>
            <Text style={{ fontSize: 12, color: COLORS.neutral[500], marginTop: 2 }}>Contact: jahedhosan5@gmail.com</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  value,
  onToggle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onToggle} activeOpacity={0.85}>
      {icon}
      <View style={styles.settingText}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <View style={[styles.switch, value ? styles.switchOn : styles.switchOff]}>
        <View style={[styles.switchThumb, value ? styles.switchThumbOn : styles.switchThumbOff]} />
      </View>
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutral[50],
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.neutral[50],
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomColor: COLORS.neutral[100],
    borderBottomWidth: 1,
  },
  headerTitle: {
    ...TYPOGRAPHY.heading,
    color: COLORS.neutral[900],
  },
  headerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.neutral[500],
    marginTop: 2,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.small,
    color: COLORS.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
    marginLeft: SPACING.xs,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.neutral[900],
    fontWeight: '600',
  },
  settingSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.neutral[500],
    marginTop: 2,
  },
  switch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  switchOn: {
    backgroundColor: COLORS.primary[600],
  },
  switchOff: {
    backgroundColor: COLORS.neutral[300],
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
  },
  switchThumbOff: {
    alignSelf: 'flex-start',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.neutral[100],
    marginVertical: SPACING.xs,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  permissionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  permissionTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.neutral[900],
    fontWeight: '600',
  },
  permissionStatus: {
    ...TYPOGRAPHY.caption,
    color: COLORS.neutral[500],
    marginTop: 2,
  },
  permBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  permButton: {
    backgroundColor: COLORS.primary[600],
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  permButtonText: {
    ...TYPOGRAPHY.small,
    color: COLORS.white,
    fontWeight: '600',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  warningText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.warning,
    flex: 1,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  aboutText: {
    ...TYPOGRAPHY.body,
    color: COLORS.neutral[900],
    flex: 1,
  },
});
