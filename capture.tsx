import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Camera, Check, X, MapPin, Loader2, RotateCcw, ImagePlus, ImageIcon, AlertTriangle, RefreshCw } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { syncGeofences } from '@/lib/geofence';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY, RADIUS_PRESETS } from '@/lib/theme';

type CaptureStep = 'method' | 'camera' | 'preview' | 'saving';

// Mecca — a sensible fallback for a mosque app when GPS is unavailable.
const FALLBACK_LOCATION = { latitude: 21.4225, longitude: 39.8262 };

type LocationSource = 'gps' | 'fallback' | 'fetching' | 'error';

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [photo, setPhoto] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [radius, setRadius] = useState<number>(150);
  const [autoSilent, setAutoSilent] = useState(true);
  const [step, setStep] = useState<CaptureStep>('method');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource>('fetching');
  const [retryingLocation, setRetryingLocation] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  useEffect(() => {
    if (step === 'preview' && !location) {
      fetchLocation();
    }
  }, [step]);

  const fetchLocation = async () => {
    setLocationSource('fetching');
    setLocationError(null);
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) {
        const req = await Location.requestForegroundPermissionsAsync();
        if (!req.granted) {
          throw new Error('Permission denied');
        }
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setLocationSource('gps');
      setLocationError(null);
    } catch {
      setLocation(FALLBACK_LOCATION);
      setLocationSource('fallback');
      setLocationError('GPS unavailable. Using default location (Mecca). You can retry to get your live location.');
    }
  };

  const retryLocation = async () => {
    setRetryingLocation(true);
    await fetchLocation();
    setRetryingLocation(false);
  };

  const useFallbackLocation = () => {
    setLocation(FALLBACK_LOCATION);
    setLocationSource('fallback');
    setLocationError('Using default location (Mecca). Tap retry to detect your live GPS instead.');
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    try {
      const photoResp = await cameraRef.current.takePictureAsync({ quality: 0.5, base64: true });
      if (!photoResp?.base64) return;
      const dataUri = `data:image/jpeg;base64,${photoResp.base64}`;
      setPhoto(dataUri);
      fetchLocation();
      setStep('preview');
    } catch {
      // ignore
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
        base64: true,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert('Unsupported image', 'Please choose a different image file.');
        return;
      }
      const dataUri = `data:image/jpeg;base64,${asset.base64}`;
      setPhoto(dataUri);
      fetchLocation();
      setStep('preview');
    } catch {
      Alert.alert('Error', 'Could not pick an image from the gallery.');
    }
  };

  const startCamera = async () => {
    if (!permission?.granted) {
      const req = await requestPermission();
      if (!req?.granted) return;
    }
    setStep('camera');
  };

  const retake = () => {
    setPhoto(null);
    setLocation(null);
    setLocationError(null);
    setName('');
    setRadius(150);
    setStep('method');
  };

  const saveMosque = async () => {
    if (!photo) return;
    const coords = location || FALLBACK_LOCATION;
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a name for this mosque.');
      return;
    }
    const radiusNum = radius;
    if (radiusNum < 50 || radiusNum > 1000) {
      Alert.alert('Invalid radius', 'Radius must be between 50 and 1000 meters.');
      return;
    }
    setStep('saving');
    const { error } = await supabase.from('mosques').insert({
      name: name.trim(),
      photo,
      latitude: coords.latitude,
      longitude: coords.longitude,
      radius: radiusNum,
      auto_silent: autoSilent,
    });
    if (error) {
      Alert.alert('Error', 'Failed to save mosque. Please try again.');
      setStep('preview');
      return;
    }
    await syncGeofences();
    router.push('/(tabs)');
  };

  if (step === 'method') {
    return (
      <SafeAreaView style={styles.methodContainer}>
        <View style={styles.methodHeader}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(tabs)')} activeOpacity={0.85}>
            <X size={22} color={COLORS.neutral[900]} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.methodTitle}>Add a Mosque</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.methodBody}>
          <Text style={styles.methodSubtitle}>
            Capture a photo of a mosque and we'll save its location as an auto-silent geofence.
          </Text>

          <TouchableOpacity
            style={styles.methodCard}
            onPress={startCamera}
            activeOpacity={0.85}>
            <View style={[styles.methodIconWrap, { backgroundColor: COLORS.primary[50] }]}>
              <Camera size={28} color={COLORS.primary[600]} strokeWidth={2} />
            </View>
            <View style={styles.methodCardText}>
              <Text style={styles.methodCardTitle}>Take Photo</Text>
              <Text style={styles.methodCardSub}>Use your camera to capture a mosque right now</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.methodCard}
            onPress={pickFromGallery}
            activeOpacity={0.85}>
            <View style={[styles.methodIconWrap, { backgroundColor: COLORS.accent[50] }]}>
              <ImagePlus size={28} color={COLORS.accent[600]} strokeWidth={2} />
            </View>
            <View style={styles.methodCardText}>
              <Text style={styles.methodCardTitle}>Choose from Gallery</Text>
              <Text style={styles.methodCardSub}>Pick an existing photo from your device</Text>
            </View>
          </TouchableOpacity>

          {permission && !permission.granted && (
            <View style={styles.methodHint}>
              <AlertTriangle size={16} color={COLORS.warning} strokeWidth={2} />
              <Text style={styles.methodHintText}>
                Camera access isn't granted yet. You can still pick a photo from your gallery, or grant camera access when you tap “Take Photo.”
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'camera') {
    return (
      <SafeAreaView style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraTopBar}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => router.push('/(tabs)')}
                activeOpacity={0.85}>
                <X size={22} color={COLORS.white} strokeWidth={2.5} />
              </TouchableOpacity>
              <View style={styles.instructionBadge}>
                <Text style={styles.instructionText}>Frame the mosque in view</Text>
              </View>
              <View style={{ width: 44 }} />
            </View>

            <View style={styles.cameraControls}>
              <TouchableOpacity
                style={styles.flipButton}
                onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
                activeOpacity={0.85}>
                <RotateCcw size={20} color={COLORS.white} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.shutterButton} onPress={takePicture} activeOpacity={0.8}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
              <View style={{ width: 56 }} />
            </View>
          </View>
        </CameraView>
      </SafeAreaView>
    );
  }

  if (step === 'preview' || step === 'saving') {
    return (
      <SafeAreaView style={styles.previewContainer}>
        <View style={styles.previewHeader}>
          <TouchableOpacity style={styles.iconButton} onPress={retake} disabled={step === 'saving'}>
            <RotateCcw size={22} color={COLORS.neutral[700]} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.previewTitle}>Review & Save</Text>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/(tabs)')}
            disabled={step === 'saving'}>
            <X size={22} color={COLORS.neutral[700]} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={styles.previewContent}>
          {photo && (
            <Image source={{ uri: photo }} style={styles.previewImage} resizeMode="cover" />
          )}

          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mosque Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Central Masjid"
                placeholderTextColor={COLORS.neutral[400]}
                value={name}
                onChangeText={setName}
                editable={step !== 'saving'}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Geofence Radius</Text>
              <View style={styles.radiusChipRow}>
                {RADIUS_PRESETS.map((preset) => {
                  const selected = radius === preset;
                  return (
                    <TouchableOpacity
                      key={preset}
                      style={[styles.radiusChip, selected && styles.radiusChipSelected]}
                      onPress={() => setRadius(preset)}
                      disabled={step === 'saving'}
                      activeOpacity={0.85}>
                      <Text style={[styles.radiusChipText, selected && styles.radiusChipTextSelected]}>
                        {preset}m
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.radiusHint}>Choose how close you need to be before the phone silences.</Text>
            </View>

            {locationSource === 'fetching' ? (
              <View style={styles.locationInfoFetching}>
                <Loader2 size={16} color={COLORS.primary[600]} strokeWidth={2} />
                <Text style={styles.locationFetchingText}>Detecting your location…</Text>
              </View>
            ) : locationSource === 'gps' ? (
              <View style={styles.locationInfo}>
                <MapPin size={16} color={COLORS.primary[600]} strokeWidth={2} />
                <Text style={styles.locationText}>
                  {location!.latitude.toFixed(5)}, {location!.longitude.toFixed(5)}
                </Text>
                <Check size={15} color={COLORS.primary[600]} strokeWidth={2.5} />
              </View>
            ) : (
              <View style={styles.locationFallbackContainer}>
                <View style={styles.locationInfoError}>
                  <MapPin size={16} color={COLORS.warning} strokeWidth={2} />
                  <Text style={styles.locationErrorText}>
                    {location!.latitude.toFixed(5)}, {location!.longitude.toFixed(5)} — {locationError || 'Using fallback location.'}
                  </Text>
                </View>
                <View style={styles.locationActions}>
                  <TouchableOpacity
                    style={styles.locationRetryBtn}
                    onPress={retryLocation}
                    disabled={retryingLocation || step === 'saving'}
                    activeOpacity={0.85}>
                    {retryingLocation ? (
                      <Loader2 size={14} color={COLORS.primary[700]} strokeWidth={2} />
                    ) : (
                      <RefreshCw size={14} color={COLORS.primary[700]} strokeWidth={2} />
                    )}
                    <Text style={styles.locationRetryText}>Retry GPS</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.silentToggle}
              onPress={() => setAutoSilent(!autoSilent)}
              disabled={step === 'saving'}
              activeOpacity={0.85}>
              <View style={styles.silentToggleText}>
                <Text style={styles.silentToggleTitle}>Auto-Silent on Entry</Text>
                <Text style={styles.silentToggleSub}>
                  Mute your phone automatically when entering this geofence
                </Text>
              </View>
              <View style={[styles.switch, autoSilent ? styles.switchOn : styles.switchOff]}>
                <View style={[styles.switchThumb, autoSilent ? styles.switchThumbOn : styles.switchThumbOff]} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.previewFooter}>
          {step === 'saving' ? (
            <View style={styles.savingContainer}>
              <ActivityIndicator size="small" color={COLORS.white} />
              <Text style={styles.savingText}>Saving mosque & activating geofence…</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.saveButton, !name.trim() && styles.saveButtonDisabled]}
              onPress={saveMosque}
              disabled={!name.trim() || step !== 'preview'}
              activeOpacity={0.85}>
              <Check size={20} color={COLORS.white} strokeWidth={2.5} />
              <Text style={styles.saveButtonText}>Save & Activate Geofence</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  methodContainer: {
    flex: 1,
    backgroundColor: COLORS.neutral[50],
  },
  methodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomColor: COLORS.neutral[100],
    borderBottomWidth: 1,
  },
  methodTitle: {
    ...TYPOGRAPHY.subheading,
    color: COLORS.neutral[900],
  },
  methodBody: {
    flex: 1,
    padding: SPACING.lg,
  },
  methodSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.neutral[500],
    textAlign: 'center',
    marginBottom: SPACING.xl,
    marginTop: SPACING.lg,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  methodIconWrap: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodCardText: {
    flex: 1,
  },
  methodCardTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.neutral[900],
    fontWeight: '600',
    fontSize: 17,
  },
  methodCardSub: {
    ...TYPOGRAPHY.caption,
    color: COLORS.neutral[500],
    marginTop: 2,
  },
  methodHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fef6e7',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  methodHintText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.warning,
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.neutral[50],
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  cameraTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionBadge: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
  },
  instructionText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  galleryButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SPACING.lg,
  },
  flipButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 4,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: COLORS.white,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: COLORS.neutral[50],
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomColor: COLORS.neutral[200],
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: {
    ...TYPOGRAPHY.subheading,
    color: COLORS.neutral[900],
  },
  previewContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  previewImage: {
    width: '100%',
    height: 240,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.small,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.neutral[600],
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.neutral[200],
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: 16,
    color: COLORS.neutral[900],
    backgroundColor: COLORS.neutral[50],
  },
  radiusChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
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
  radiusHint: {
    ...TYPOGRAPHY.caption,
    color: COLORS.neutral[400],
    marginTop: SPACING.sm,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary[50],
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  locationText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary[700],
    fontWeight: '600',
    flex: 1,
  },
  locationInfoError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef6e7',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  locationInfoFetching: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary[50],
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  locationFetchingText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary[700],
    fontWeight: '600',
    flex: 1,
  },
  locationFallbackContainer: {
    marginBottom: SPACING.md,
  },
  locationActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  locationRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary[50],
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.primary[200],
  },
  locationRetryText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary[700],
  },
  locationErrorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.warning,
    flex: 1,
  },
  silentToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  silentToggleText: {
    flex: 1,
    marginRight: SPACING.md,
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
  previewFooter: {
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderTopColor: COLORS.neutral[200],
    borderTopWidth: 1,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary[600],
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    ...SHADOWS.small,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.neutral[300],
  },
  saveButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    fontWeight: '600',
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.primary[600],
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  savingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    fontWeight: '600',
  },
});
