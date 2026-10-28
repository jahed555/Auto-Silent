import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MapPin, Bell, BellOff, Trash2, Ruler, Navigation, Check } from 'lucide-react-native';
import { supabase, Mosque } from '@/lib/supabase';
import { syncGeofences } from '@/lib/geofence';
import { getInsideMosques } from '@/lib/silent-state';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY, RADIUS_PRESETS } from '@/lib/theme';

export default function MosqueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [mosque, setMosque] = useState<Mosque | null>(null);
  const [loading, setLoading] = useState(true);
  const [inside, setInside] = useState(false);
  const [editingRadius, setEditingRadius] = useState(false);
  const [savingRadius, setSavingRadius] = useState(false);

  const loadMosque = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase.from('mosques').select('*').eq('id', id).maybeSingle();
    if (error || !data) {
      setLoading(false);
      return;
    }
    setMosque(data as Mosque);
    const ids = await getInsideMosques();
    setInside(ids.includes(id));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadMosque();
    const interval = setInterval(() => {
      getInsideMosques().then((ids) => setInside(ids.includes(id)));
    }, 5000);
    return () => clearInterval(interval);
  }, [id, loadMosque]);

  const toggleAutoSilent = async () => {
    if (!mosque) return;
    const updated = !mosque.auto_silent;
    setMosque({ ...mosque, auto_silent: updated });
    await supabase.from('mosques').update({ auto_silent: updated }).eq('id', mosque.id);
    await syncGeofences();
  };

  const changeRadius = async (newRadius: number) => {
    if (!mosque) return;
    setSavingRadius(true);
    setMosque({ ...mosque, radius: newRadius });
    await supabase.from('mosques').update({ radius: newRadius }).eq('id', mosque.id);
    await syncGeofences();
    setSavingRadius(false);
    setEditingRadius(false);
  };

  const handleDelete = () => {
    Alert.alert('Delete Mosque', `Remove "${mosque?.name}" and its geofence?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('mosques').delete().eq('id', mosque?.id);
          await syncGeofences();
          router.push('/(tabs)');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary[600]} />
      </SafeAreaView>
    );
  }

  if (!mosque) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.notFound}>Mosque not found.</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)')}>
          <Text style={styles.backLink}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(tabs)')}>
          <ArrowLeft size={22} color={COLORS.neutral[900]} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Mosque Details</Text>
        <TouchableOpacity style={styles.iconButton} onPress={handleDelete}>
          <Trash2 size={20} color={COLORS.error} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Image source={{ uri: mosque.photo }} style={styles.heroImage} resizeMode="cover" />

        <View style={styles.infoCard}>
          <Text style={styles.mosqueName}>{mosque.name}</Text>

          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, inside ? styles.statusActive : styles.statusInactive]}>
              <View style={[styles.statusDot, inside ? styles.statusDotActive : styles.statusDotInactive]} />
              <Text style={[styles.statusText, inside ? styles.statusTextActive : styles.statusTextInactive]}>
                {inside ? 'You are in range' : 'Out of range'}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <MapPin size={18} color={COLORS.primary[600]} strokeWidth={2} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>GPS Coordinates</Text>
              <Text style={styles.detailValue}>
                {mosque.latitude.toFixed(5)}, {mosque.longitude.toFixed(5)}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Ruler size={18} color={COLORS.primary[600]} strokeWidth={2} />
            <View style={styles.detailContent}>
              <View style={styles.radiusRowHeader}>
                <Text style={styles.detailLabel}>Geofence Radius</Text>
                <TouchableOpacity onPress={() => setEditingRadius(!editingRadius)} activeOpacity={0.85}>
                  <Text style={styles.editLink}>{editingRadius ? 'Done' : 'Edit'}</Text>
                </TouchableOpacity>
              </View>
              {editingRadius ? (
                <View style={styles.radiusChipRow}>
                  {RADIUS_PRESETS.map((preset) => {
                    const selected = mosque.radius === preset;
                    return (
                      <TouchableOpacity
                        key={preset}
                        style={[styles.radiusChip, selected && styles.radiusChipSelected]}
                        onPress={() => changeRadius(preset)}
                        disabled={savingRadius}
                        activeOpacity={0.85}>
                        <Text style={[styles.radiusChipText, selected && styles.radiusChipTextSelected]}>
                          {preset}m
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.detailValue}>{mosque.radius} meters</Text>
              )}
            </View>
          </View>

          <View style={styles.detailRow}>
            <Navigation size={18} color={COLORS.primary[600]} strokeWidth={2} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Auto-Silent</Text>
              <Text style={styles.detailValue}>
                {mosque.auto_silent ? 'Enabled — phone silences on entry' : 'Disabled'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.silentToggleCard} onPress={toggleAutoSilent} activeOpacity={0.85}>
          {mosque.auto_silent ? (
            <BellOff size={22} color={COLORS.primary[600]} strokeWidth={2} />
          ) : (
            <Bell size={22} color={COLORS.neutral[400]} strokeWidth={2} />
          )}
          <View style={styles.silentToggleText}>
            <Text style={styles.silentToggleTitle}>Auto-Silent on Entry</Text>
            <Text style={styles.silentToggleSub}>
              {mosque.auto_silent ? 'Active for this mosque' : 'Tap to enable auto-silent'}
            </Text>
          </View>
          <View style={[styles.switch, mosque.auto_silent ? styles.switchOn : styles.switchOff]}>
            <View style={[styles.switchThumb, mosque.auto_silent ? styles.switchThumbOn : styles.switchThumbOff]} />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomColor: COLORS.neutral[100],
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.subheading,
    color: COLORS.neutral[900],
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  heroImage: {
    width: '100%',
    height: 220,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  mosqueName: {
    ...TYPOGRAPHY.heading,
    color: COLORS.neutral[900],
    marginBottom: SPACING.md,
  },
  statusRow: {
    marginBottom: SPACING.lg,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  statusActive: {
    backgroundColor: COLORS.primary[50],
  },
  statusInactive: {
    backgroundColor: COLORS.neutral[100],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: COLORS.primary[600],
  },
  statusDotInactive: {
    backgroundColor: COLORS.neutral[400],
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusTextActive: {
    color: COLORS.primary[700],
  },
  statusTextInactive: {
    color: COLORS.neutral[500],
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.neutral[900],
    marginTop: 2,
  },
  radiusRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editLink: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary[600],
  },
  radiusChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: 6,
  },
  radiusChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: COLORS.neutral[200],
    backgroundColor: COLORS.neutral[50],
  },
  radiusChipSelected: {
    borderColor: COLORS.primary[600],
    backgroundColor: COLORS.primary[600],
  },
  radiusChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.neutral[600],
  },
  radiusChipTextSelected: {
    color: COLORS.white,
  },
  silentToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.small,
  },
  silentToggleText: {
    flex: 1,
  },
  silentToggleTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.neutral[900],
    fontWeight: '600',
  },
  silentToggleSub: {
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
  notFound: {
    ...TYPOGRAPHY.body,
    color: COLORS.neutral[500],
    marginBottom: SPACING.md,
  },
  backLink: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary[600],
    fontWeight: '600',
  },
});
