import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, MapPin, BellOff, Bell, Trash2, Navigation } from 'lucide-react-native';
import { supabase, Mosque } from '@/lib/supabase';
import { getInsideMosques } from '@/lib/silent-state';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/lib/theme';

export default function MosquesScreen() {
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insideIds, setInsideIds] = useState<string[]>([]);
  const router = useRouter();

  const loadMosques = useCallback(async () => {
    const { data, error } = await supabase.from('mosques').select('*').order('created_at', { ascending: false });
    if (error) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setMosques((data as Mosque[]) || []);
    const ids = await getInsideMosques();
    setInsideIds(ids);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMosques();
    }, [loadMosques])
  );

  useEffect(() => {
    const interval = setInterval(() => {
      getInsideMosques().then(setInsideIds);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadMosques();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('mosques').delete().eq('id', id);
    loadMosques();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary[600]} />
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: Mosque }) => {
    const isInside = insideIds.includes(item.id);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => router.push({ pathname: '/mosque/[id]', params: { id: item.id } })}>
        <Image source={{ uri: item.photo }} style={styles.cardImage} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
            {item.auto_silent ? (
              <BellOff size={16} color={COLORS.primary[600]} strokeWidth={2} />
            ) : (
              <Bell size={16} color={COLORS.neutral[400]} strokeWidth={2} />
            )}
          </View>
          <View style={styles.cardMeta}>
            <MapPin size={13} color={COLORS.neutral[500]} strokeWidth={2} />
            <Text style={styles.cardMetaText}>
              {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
            </Text>
          </View>
          <View style={styles.cardFooter}>
            <View style={[styles.badge, isInside ? styles.badgeActive : styles.badgeInactive]}>
              <View style={[styles.badgeDot, isInside ? styles.badgeDotActive : styles.badgeDotInactive]} />
              <Text style={[styles.badgeText, isInside ? styles.badgeTextActive : styles.badgeTextInactive]}>
                {isInside ? 'In range' : 'Out of range'}
              </Text>
            </View>
            <Text style={styles.radiusText}>{item.radius}m radius</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item.id)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Trash2 size={18} color={COLORS.error} strokeWidth={2} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Saved Mosques</Text>
          <Text style={styles.headerSubtitle}>
            {mosques.length} {mosques.length === 1 ? 'mosque' : 'mosques'} · Auto-silent active
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(tabs)/capture')}
          activeOpacity={0.85}>
          <Plus size={22} color={COLORS.white} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {mosques.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Navigation size={48} color={COLORS.primary[400]} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>No mosques saved yet</Text>
          <Text style={styles.emptyText}>
            Capture a photo of a mosque to create a geofence. Your phone will automatically go silent when you enter the area.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)/capture')}
            activeOpacity={0.85}>
            <Plus size={20} color={COLORS.white} strokeWidth={2.5} />
            <Text style={styles.emptyButtonText}>Capture a Mosque</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={mosques}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.primary[600]} />}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  addButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  list: {
    padding: SPACING.lg,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  cardImage: {
    width: 88,
    height: 88,
    resizeMode: 'cover',
  },
  cardContent: {
    flex: 1,
    padding: SPACING.md,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    ...TYPOGRAPHY.subheading,
    color: COLORS.neutral[900],
    flex: 1,
    marginRight: SPACING.sm,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.neutral[500],
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  badgeActive: {
    backgroundColor: COLORS.primary[50],
  },
  badgeInactive: {
    backgroundColor: COLORS.neutral[100],
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeDotActive: {
    backgroundColor: COLORS.primary[600],
  },
  badgeDotInactive: {
    backgroundColor: COLORS.neutral[400],
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeTextActive: {
    color: COLORS.primary[700],
  },
  badgeTextInactive: {
    color: COLORS.neutral[500],
  },
  radiusText: {
    ...TYPOGRAPHY.small,
    color: COLORS.neutral[500],
  },
  deleteBtn: {
    padding: SPACING.md,
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    ...TYPOGRAPHY.heading,
    color: COLORS.neutral[900],
    marginBottom: SPACING.sm,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.neutral[500],
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary[600],
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    ...SHADOWS.small,
  },
  emptyButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    fontWeight: '600',
  },
});
