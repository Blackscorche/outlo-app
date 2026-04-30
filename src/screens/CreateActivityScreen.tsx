import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { showImagePickerOptions } from "../utils/imagePicker";
import { useActivities } from "../hooks/useActivities";
import { validateSafeText } from "../utils/contentModeration";
import {
  ACTIVITY_CATEGORIES,
  JOIN_TYPES,
  formatPrice,
  getCategoryDefaultImage,
  PLATFORM_FEE_BPS,
  TICKET_PRICE_TIERS,
} from "../constants/activityCategories";
import MapView, { Marker } from "react-native-maps";
import PriceBadge from "../components/PriceBadge";
import { supabase } from "../integrations/supabase/client";
import { useTheme } from '../contexts/ThemeContext';

const TOTAL_STEPS = 7;

interface FormState {
  category: string | null;
  title: string;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  scheduledAt: Date;
  durationMinutes: number | null;
  description: string;
  maxParticipants: number;
  joinType: "everyone" | "beginners" | "advanced";
  isPaid: boolean;
  ticketPriceCents: number;
  paymentRequiredToJoin: boolean;
  imageUri: string | null;
}

export default function CreateActivityScreen({ navigation }: any) {
  console.log('CreateActivity rendering');
  const { theme } = useTheme();
  const styles = makeStyles(theme);
  const { createActivity } = useActivities();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [form, setForm] = useState<FormState>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return {
      category: null,
      title: "",
      locationName: "",
      latitude: null,
      longitude: null,
      scheduledAt: d,
      durationMinutes: 60,
      description: "",
      maxParticipants: 8,
      joinType: "everyone",
      isPaid: false,
      ticketPriceCents: 0,
      paymentRequiredToJoin: true,
      imageUri: null,
    };
  });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  // ---------- Step gates ----------
  const canContinue = useMemo(() => {
    switch (step) {
      case 1:
        return !!form.category && form.title.trim().length >= 3;
      case 2:
        return (
          form.locationName.trim().length > 0 &&
          form.latitude !== null &&
          form.longitude !== null
        );
      case 3:
        return form.scheduledAt.getTime() > Date.now();
      case 4:
        return form.description.trim().length === 0 || form.description.trim().length >= 5;
      case 5:
        return !form.isPaid || (form.ticketPriceCents > 0 && form.maxParticipants > 0);
      case 6:
        return true; // image is optional
      case 7:
        return true;
      default:
        return false;
    }
  }, [step, form]);

  // ---------- Handlers ----------
  const next = () => {
    if (!canContinue) return;
    if (step < TOTAL_STEPS) setStep(step + 1);
  };
  const back = () => {
    if (step > 1) setStep(step - 1);
    else navigation.goBack();
  };

  const pickImage = () => {
    showImagePickerOptions(
      { allowsEditing: true, aspect: [16, 9], quality: 0.85 },
      (uri) => update("imageUri", uri),
    );
  };

  const onPublish = async () => {
    // Content moderation
    const titleCheck = validateSafeText(form.title, "title");
    if (!titleCheck.valid) {
      Alert.alert("Not Allowed", titleCheck.message);
      return;
    }
    if (form.description.trim()) {
      const dCheck = validateSafeText(form.description, "description");
      if (!dCheck.valid) {
        Alert.alert("Not Allowed", dCheck.message);
        return;
      }
    }

    try {
      setSubmitting(true);

      // Upload image if any
      let imageUrl: string | null = null;
      if (form.imageUri) {
        imageUrl = await uploadActivityImage(form.imageUri);
      }

      const activityId = await createActivity({
        activity_type: form.category || "events",
        category: form.category,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        image_url: imageUrl,
        location_name: form.locationName.trim(),
        latitude: form.latitude!,
        longitude: form.longitude!,
        scheduled_at: form.scheduledAt.toISOString(),
        duration_minutes: form.durationMinutes,
        max_participants: form.maxParticipants,
        join_type: form.joinType,
        is_paid: form.isPaid,
        ticket_price_cents: form.isPaid ? form.ticketPriceCents : 0,
        currency: "EUR",
        payment_required_to_join: form.isPaid ? form.paymentRequiredToJoin : false,
        status: form.isPaid ? "published" : "open",
      });

      if (!activityId) return;

      // Replace stack with the published-success screen so back doesn't return to the wizard
      navigation.replace("ActivityPublished", {
        activityId,
        isPaid: form.isPaid,
      });
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not publish activity");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Render helpers (moved inside component to access styles) ----------
  const StepDotsBar = ({ step, total }: { step: number; total: number }) => {
    return (
      <View style={styles.dotsBar}>
        <Text style={styles.dotsBarLabel}>Step {step} of {total}</Text>
        <View style={styles.dotsRow}>
          {Array.from({ length: total }, (_, i) => {
            const n = i + 1;
            const completed = n < step;
            const current = n === step;
            return (
              <React.Fragment key={n}>
                {i > 0 && (
                  <View
                    style={[
                      styles.dotsLine,
                      n <= step ? styles.dotsLineGreen : styles.dotsLineGrey,
                    ]}
                  />
                )}
                <View style={[styles.dotWrap, current && styles.dotWrapCurrent]}>
                  <View
                    style={[
                      styles.dotCore,
                      completed || current ? styles.dotCoreGreen : styles.dotCoreEmpty,
                    ]}
                  />
                </View>
              </React.Fragment>
            );
          })}
        </View>
      </View>
    );
  };

  // ---------- Render ----------
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={back} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Activity</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="close" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <StepDotsBar step={step} total={TOTAL_STEPS} styles={styles} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {step === 1 && <Step1 form={form} update={update} styles={styles} />}
          {step === 2 && <Step2 form={form} update={update} styles={styles} />}
          {step === 3 && (
            <Step3
              form={form}
              update={update}
              styles={styles}
              showDatePicker={showDatePicker}
              setShowDatePicker={setShowDatePicker}
              showTimePicker={showTimePicker}
              setShowTimePicker={setShowTimePicker}
            />
          )}
          {step === 4 && <Step4 form={form} update={update} styles={styles} />}
          {step === 5 && <Step5 form={form} update={update} styles={styles} />}
          {step === 6 && <Step6 form={form} pickImage={pickImage} update={update} styles={styles} />}
          {step === 7 && <Step7 form={form} styles={styles} />}
        </ScrollView>

        {/* Sticky bottom CTA */}
        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity style={styles.secondaryBtn} onPress={back} disabled={submitting}>
              <Text style={styles.secondaryBtnText}>Back</Text>
            </TouchableOpacity>
          )}
          {step < TOTAL_STEPS ? (
            <TouchableOpacity
              style={[styles.primaryBtn, !canContinue && styles.btnDisabled]}
              onPress={next}
              disabled={!canContinue}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, submitting && styles.btnDisabled]}
              onPress={onPublish}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Publish</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ====================================================================
// Step components
// ====================================================================

function StepDotsBar({ step, total, styles }: { step: number; total: number; styles: any }) {
  return (
    <View style={styles.dotsBar}>
      <Text style={styles.dotsBarLabel}>Step {step} of {total}</Text>
      <View style={styles.dotsRow}>
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const completed = n < step;
          const current = n === step;
          return (
            <React.Fragment key={n}>
              {i > 0 && (
                <View
                  style={[
                    styles.dotsLine,
                    n <= step ? styles.dotsLineGreen : styles.dotsLineGrey,
                  ]}
                />
              )}
              <View style={[styles.dotWrap, current && styles.dotWrapCurrent]}>
                <View
                  style={[
                    styles.dotCore,
                    completed || current ? styles.dotCoreGreen : styles.dotCoreEmpty,
                  ]}
                />
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

function Step1({ form, update, styles }: any) {
  return (
    <View>
      <Text style={styles.stepHeading}>What kind of activity?</Text>
      <Text style={styles.stepSub}>Pick a category and give it a clear title.</Text>

      <View style={styles.categoryGrid}>
        {ACTIVITY_CATEGORIES.map((c) => {
          const selected = form.category === c.id;
          return (
            <TouchableOpacity
              key={c.id}
              style={[
                styles.categoryCard,
                selected && { borderColor: c.color, backgroundColor: `${c.color}15` },
              ]}
              onPress={() => update("category", c.id)}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.categoryIcon,
                  { backgroundColor: selected ? c.color : `${c.color}22` },
                ]}
              >
                <Ionicons name={c.icon} size={20} color={selected ? "#fff" : c.color} />
              </View>
              <Text style={[styles.categoryLabel, selected && { color: c.color, fontWeight: "700" }]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Title</Text>
      <TextInput
        value={form.title}
        onChangeText={(v: string) => update("title", v)}
        placeholder="e.g. Saturday morning run in Phoenix Park"
        placeholderTextColor="#9CA3AF"
        style={styles.input}
        maxLength={80}
      />
      <Text style={styles.helper}>{form.title.length}/80</Text>
    </View>
  );
}

function Step2({ form, update, styles }: any) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showFullMap, setShowFullMap] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [fullMapSearchQuery, setFullMapSearchQuery] = useState("");
  const [fullMapSearching, setFullMapSearching] = useState(false);
  const mapRef = useRef<any>(null);
  const fullMapRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      setLocating(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission needed", "Allow location to set your activity place");
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;
        setUserCoords({ latitude, longitude });
        if (form.latitude === null) {
          const [addr] = await Location.reverseGeocodeAsync({ latitude, longitude });
          update("latitude", latitude);
          update("longitude", longitude);
          const parts = [addr?.name, addr?.street, addr?.city].filter(Boolean);
          update("locationName", parts.join(", ") || "Current location");
          mapRef.current?.animateToRegion(
            { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
            300
          );
        }
      } catch {
        Alert.alert("Error", "Could not get your location");
      } finally {
        setLocating(false);
      }
    })();
  }, []);

  const handleMapPress = async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    update("latitude", latitude);
    update("longitude", longitude);
    try {
      const [addr] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const parts = [addr?.name, addr?.street, addr?.city].filter(Boolean);
      update("locationName", parts.join(", ") || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    } catch {
      update("locationName", `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await Location.geocodeAsync(searchQuery.trim());
      if (results.length === 0) {
        Alert.alert("Not found", "No results for that location");
        return;
      }
      const { latitude, longitude } = results[0];
      update("latitude", latitude);
      update("longitude", longitude);
      update("locationName", searchQuery.trim());
      mapRef.current?.animateToRegion(
        { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        500
      );
    } catch {
      Alert.alert("Error", "Could not find that location");
    } finally {
      setSearching(false);
    }
  };

  const openFullMap = () => {
    if (form.latitude !== null && form.longitude !== null) {
      setPendingCoords({ latitude: form.latitude, longitude: form.longitude });
      setPendingName(form.locationName || "");
    } else if (userCoords) {
      setPendingCoords(userCoords);
      setPendingName("");
    } else {
      setPendingCoords(null);
      setPendingName("");
    }
    setFullMapSearchQuery("");
    setShowFullMap(true);
  };

  const handleFullMapPress = async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPendingCoords({ latitude, longitude });
    try {
      const [addr] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const parts = [addr?.name, addr?.street, addr?.city].filter(Boolean);
      setPendingName(parts.join(", ") || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    } catch {
      setPendingName(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
    }
  };

  const handleFullMapSearch = async () => {
    if (!fullMapSearchQuery.trim()) return;
    setFullMapSearching(true);
    try {
      const results = await Location.geocodeAsync(fullMapSearchQuery.trim());
      if (results.length === 0) {
        Alert.alert("Not found", "No results for that location");
        return;
      }
      const { latitude, longitude } = results[0];
      setPendingCoords({ latitude, longitude });
      setPendingName(fullMapSearchQuery.trim());
      fullMapRef.current?.animateToRegion(
        { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        500
      );
    } catch {
      Alert.alert("Error", "Could not find that location");
    } finally {
      setFullMapSearching(false);
    }
  };

  const confirmLocation = () => {
    if (pendingCoords) {
      update("latitude", pendingCoords.latitude);
      update("longitude", pendingCoords.longitude);
      update(
        "locationName",
        pendingName || `${pendingCoords.latitude.toFixed(4)}, ${pendingCoords.longitude.toFixed(4)}`
      );
    }
    setShowFullMap(false);
  };

  const distance = useMemo(() => {
    if (!userCoords || form.latitude === null || form.longitude === null) return null;
    return haversineKm(userCoords.latitude, userCoords.longitude, form.latitude, form.longitude);
  }, [userCoords, form.latitude, form.longitude]);

  const initialRegion = {
    latitude: form.latitude ?? 53.3498,
    longitude: form.longitude ?? -6.2603,
    latitudeDelta: form.latitude !== null ? 0.01 : 0.1,
    longitudeDelta: form.latitude !== null ? 0.01 : 0.1,
  };

  const fullMapInitialRegion = {
    latitude: pendingCoords?.latitude ?? userCoords?.latitude ?? 53.3498,
    longitude: pendingCoords?.longitude ?? userCoords?.longitude ?? -6.2603,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  return (
    <View>
      <Text style={styles.stepHeading}>Where is it?</Text>
      <Text style={styles.stepSub}>Set the meeting place. People will see it on the map.</Text>

      <View style={styles.searchRow}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          placeholder="Search for a place…"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
          {searching ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="search" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.mapContainer}>
        {locating && (
          <View style={styles.mapOverlay}>
            <ActivityIndicator color="#4CAF50" />
            <Text style={styles.mapOverlayText}>Locating you…</Text>
          </View>
        )}
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          onPress={handleMapPress}
        >
          {form.latitude !== null && form.longitude !== null && (
            <Marker
              coordinate={{ latitude: form.latitude, longitude: form.longitude }}
              pinColor="#4CAF50"
            />
          )}
        </MapView>
        <View style={styles.mapTapHint}>
          <Ionicons name="finger-print-outline" size={13} color="rgba(255,255,255,0.85)" />
          <Text style={styles.mapTapHintText}>Tap map to pin</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.openMapBtn} onPress={openFullMap}>
        <Ionicons name="expand-outline" size={18} color="#4CAF50" />
        <Text style={styles.openMapBtnText}>Pick on Full Map</Text>
      </TouchableOpacity>

      {form.locationName ? (
        <View style={styles.locationInfoCard}>
          <Ionicons name="pin" size={16} color="#4CAF50" />
          <View style={{ flex: 1 }}>
            <Text style={styles.locationInfoName} numberOfLines={2}>{form.locationName}</Text>
            {distance !== null && distance > 0.05 && (
              <Text style={styles.locationInfoDist}>{formatDistance(distance)} from your location</Text>
            )}
          </View>
        </View>
      ) : null}

      {/* ── Full-Screen Map Picker Modal ── */}
      <Modal visible={showFullMap} animationType="slide" statusBarTranslucent>
        <SafeAreaView style={styles.fullMapSafe} edges={["top", "bottom"]}>
          <View style={styles.fullMapHeader}>
            <TouchableOpacity style={styles.fullMapBackBtn} onPress={() => setShowFullMap(false)}>
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.fullMapTitle}>Pick Location</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.fullMapSearchRow}>
            <TextInput
              value={fullMapSearchQuery}
              onChangeText={setFullMapSearchQuery}
              onSubmitEditing={handleFullMapSearch}
              placeholder="Search address or place…"
              placeholderTextColor="#9CA3AF"
              style={styles.fullMapSearchInput}
              returnKeyType="search"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.fullMapSearchBtn}
              onPress={handleFullMapSearch}
              disabled={fullMapSearching}
            >
              {fullMapSearching ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="search" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          <MapView
            ref={fullMapRef}
            style={styles.fullMap}
            initialRegion={fullMapInitialRegion}
            onPress={handleFullMapPress}
          >
            {pendingCoords && (
              <Marker coordinate={pendingCoords} pinColor="#4CAF50" />
            )}
          </MapView>

          <View style={styles.fullMapBottom}>
            {pendingName ? (
              <View style={styles.fullMapLocationBar}>
                <Ionicons name="pin" size={16} color="#4CAF50" />
                <Text style={styles.fullMapLocationText} numberOfLines={2}>{pendingName}</Text>
              </View>
            ) : (
              <View style={styles.fullMapHint}>
                <Ionicons name="hand-left-outline" size={16} color="#B3B3B3" />
                <Text style={styles.fullMapHintText}>Tap anywhere on the map to set a location</Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.fullMapConfirmBtn, !pendingCoords && styles.btnDisabled]}
              onPress={confirmLocation}
              disabled={!pendingCoords}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.fullMapConfirmText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function Step3({
  form,
  update,
  styles,
  showDatePicker,
  setShowDatePicker,
  showTimePicker,
  setShowTimePicker,
}: any) {
  const onDate = (_: any, d?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (d) {
      const merged = new Date(form.scheduledAt);
      merged.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
      update("scheduledAt", merged);
    }
  };
  const onTime = (_: any, d?: Date) => {
    if (Platform.OS === "android") setShowTimePicker(false);
    if (d) {
      const merged = new Date(form.scheduledAt);
      merged.setHours(d.getHours(), d.getMinutes(), 0, 0);
      update("scheduledAt", merged);
    }
  };

  const dateLabel = form.scheduledAt.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeLabel = form.scheduledAt.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View>
      <Text style={styles.stepHeading}>When is it?</Text>
      <Text style={styles.stepSub}>Pick the date, time and (optional) duration.</Text>

      <TouchableOpacity style={styles.tile} onPress={() => setShowDatePicker(true)}>
        <Ionicons name="calendar" size={20} color="#4CAF50" />
        <View style={{ flex: 1 }}>
          <Text style={styles.tileLabel}>Date</Text>
          <Text style={styles.tileValue}>{dateLabel}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.tile} onPress={() => setShowTimePicker(true)}>
        <Ionicons name="time" size={20} color="#4CAF50" />
        <View style={{ flex: 1 }}>
          <Text style={styles.tileLabel}>Start time</Text>
          <Text style={styles.tileValue}>{timeLabel}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>

      <Text style={styles.label}>Duration</Text>
      <View style={styles.chipRow}>
        {[30, 60, 90, 120, 180].map((m) => {
          const active = form.durationMinutes === m;
          return (
            <TouchableOpacity
              key={m}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => update("durationMinutes", m)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {m < 60 ? `${m}m` : `${m / 60}h`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={form.scheduledAt}
          mode="date"
          minimumDate={new Date()}
          onChange={onDate}
          display={Platform.OS === "ios" ? "spinner" : "default"}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={form.scheduledAt}
          mode="time"
          onChange={onTime}
          display={Platform.OS === "ios" ? "spinner" : "default"}
        />
      )}
    </View>
  );
}

function Step4({ form, update, styles }: any) {
  return (
    <View>
      <Text style={styles.stepHeading}>Tell people more</Text>
      <Text style={styles.stepSub}>Optional details to attract the right attendees.</Text>

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        value={form.description}
        onChangeText={(v: string) => update("description", v)}
        placeholder="What will you do? What should people bring?"
        placeholderTextColor="#9CA3AF"
        style={[styles.input, styles.textarea]}
        multiline
        maxLength={500}
      />
      <Text style={styles.helper}>{form.description.length}/500</Text>

      <Text style={styles.label}>Max participants</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() =>
            update("maxParticipants", Math.max(2, form.maxParticipants - 1))
          }
        >
          <Ionicons name="remove" size={20} color="#4CAF50" />
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{form.maxParticipants}</Text>
        <TouchableOpacity
          style={styles.stepperBtn}
          onPress={() =>
            update("maxParticipants", Math.min(100, form.maxParticipants + 1))
          }
        >
          <Ionicons name="add" size={20} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Who can join?</Text>
      <View style={{ gap: 8 }}>
        {JOIN_TYPES.map((j) => {
          const active = form.joinType === j.id;
          return (
            <TouchableOpacity
              key={j.id}
              style={[styles.optionRow, active && styles.optionRowActive]}
              onPress={() => update("joinType", j.id)}
            >
              <View
                style={[
                  styles.radio,
                  active && { borderColor: "#4CAF50", backgroundColor: "#4CAF50" },
                ]}
              >
                {active && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{j.label}</Text>
                <Text style={styles.optionSub}>{j.description}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function Step5({ form, update, styles }: any) {
  const platformFeeCents = Math.round(
    (form.ticketPriceCents * PLATFORM_FEE_BPS) / 10000,
  );
  const payoutCents = form.ticketPriceCents - platformFeeCents;

  return (
    <View>
      <Text style={styles.stepHeading}>Free or paid?</Text>
      <Text style={styles.stepSub}>You can sell tickets through Outlo.</Text>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleCard, !form.isPaid && styles.toggleActive]}
          onPress={() => update("isPaid", false)}
        >
          <Ionicons name="people" size={20} color={!form.isPaid ? "#4CAF50" : "#6B7280"} />
          <Text style={[styles.toggleTitle, !form.isPaid && { color: "#4CAF50" }]}>Free</Text>
          <Text style={styles.toggleSub}>Anyone can join</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleCard, form.isPaid && styles.toggleActive]}
          onPress={() => update("isPaid", true)}
        >
          <Ionicons name="ticket" size={20} color={form.isPaid ? "#4CAF50" : "#6B7280"} />
          <Text style={[styles.toggleTitle, form.isPaid && { color: "#4CAF50" }]}>Paid</Text>
          <Text style={styles.toggleSub}>Sell tickets</Text>
        </TouchableOpacity>
      </View>

      {form.isPaid && (
        <View>
          <Text style={styles.label}>Select ticket price</Text>
          <View style={styles.priceTierGrid}>
            {TICKET_PRICE_TIERS.map((tier) => {
              const selected = form.ticketPriceCents === tier.priceCents;
              return (
                <TouchableOpacity
                  key={tier.productId}
                  style={[
                    styles.priceTierBtn,
                    selected && styles.priceTierBtnActive,
                  ]}
                  onPress={() => update("ticketPriceCents", tier.priceCents)}
                >
                  <Text
                    style={[
                      styles.priceTierLabel,
                      selected && styles.priceTierLabelActive,
                    ]}
                  >
                    {tier.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {form.ticketPriceCents > 0 && (
            <View style={styles.feeBreakdown}>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabel}>You receive per ticket</Text>
                <Text style={styles.feeValue}>{formatPrice(payoutCents)}</Text>
              </View>
              <View style={styles.feeRow}>
                <Text style={styles.feeLabelMuted}>
                  Platform fee ({PLATFORM_FEE_BPS / 100}%)
                </Text>
                <Text style={styles.feeValueMuted}>
                  −{formatPrice(platformFeeCents)}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.toggleSwitchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Require payment to join</Text>
              <Text style={styles.helper}>
                If off, users can RSVP but pay later. Recommended: on.
              </Text>
            </View>
            <Switch
              value={form.paymentRequiredToJoin}
              onValueChange={(v) => update("paymentRequiredToJoin", v)}
              trackColor={{ false: "#D1D5DB", true: "#86EFAC" }}
              thumbColor={form.paymentRequiredToJoin ? "#4CAF50" : "#fff"}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function Step6({ form, pickImage, update, styles }: any) {
  const fallback = getCategoryDefaultImage(form.category);
  return (
    <View>
      <Text style={styles.stepHeading}>Add an image</Text>
      <Text style={styles.stepSub}>
        Optional. We'll use a category image if you skip this.
      </Text>

      <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.85}>
        {form.imageUri ? (
          <Image source={{ uri: form.imageUri }} style={styles.imagePreview} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="image" size={36} color="#4CAF50" />
            <Text style={styles.imagePickerText}>Tap to upload</Text>
          </View>
        )}
      </TouchableOpacity>

      {form.imageUri && (
        <TouchableOpacity
          style={styles.removeImageBtn}
          onPress={() => update("imageUri", null)}
        >
          <Ionicons name="trash" size={16} color="#DC2626" />
          <Text style={styles.removeImageText}>Remove image</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Step7({ form, styles }: any) {
  const cat = ACTIVITY_CATEGORIES.find((c) => c.id === form.category);
  return (
    <View>
      <Text style={styles.stepHeading}>Review & publish</Text>
      <Text style={styles.stepSub}>Check everything looks good.</Text>

      <View style={styles.previewCard}>
        {form.imageUri ? (
          <Image source={{ uri: form.imageUri }} style={styles.previewImg} />
        ) : (
          <Image source={getCategoryDefaultImage(form.category)} style={styles.previewImg} />
        )}

        <View style={{ padding: 14 }}>
          <View style={styles.previewBadgeRow}>
            {cat && (
              <View style={[styles.catChip, { backgroundColor: `${cat.color}22` }]}>
                <Ionicons name={cat.icon} size={12} color={cat.color} />
                <Text style={[styles.catChipText, { color: cat.color }]}>{cat.label}</Text>
              </View>
            )}
            <PriceBadge
              isPaid={form.isPaid}
              priceCents={form.ticketPriceCents}
              size="sm"
            />
          </View>

          <Text style={styles.previewTitle}>{form.title || "Untitled"}</Text>

          <PreviewRow icon="calendar" text={form.scheduledAt.toLocaleString()} styles={styles} />
          <PreviewRow icon="time" text={`${form.durationMinutes ?? 60} minutes`} styles={styles} />
          <PreviewRow icon="location" text={form.locationName || "—"} styles={styles} />
          <PreviewRow icon="people" text={`Up to ${form.maxParticipants} attendees`} styles={styles} />

          {form.description ? (
            <Text style={styles.previewDesc}>{form.description}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function PreviewRow({ icon, text, styles }: { icon: any; text: string; styles: any }) {
  return (
    <View style={styles.previewRow}>
      <Ionicons name={icon} size={14} color="#6B7280" />
      <Text style={styles.previewRowText}>{text}</Text>
    </View>
  );
}

// ====================================================================
// Helpers
// ====================================================================

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// ====================================================================
// Image upload helper
// ====================================================================

async function uploadActivityImage(uri: string): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const filename = `${user.id}/${Date.now()}.jpg`;
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = (reader.result as string).split(",")[1];
          const decoded = atob(base64);
          const buf = new Uint8Array(decoded.length);
          for (let i = 0; i < decoded.length; i++) buf[i] = decoded.charCodeAt(i);

          const { error } = await supabase.storage
            .from("posts-media")
            .upload(filename, buf.buffer, {
              contentType: "image/jpeg",
              cacheControl: "3600",
              upsert: true,
            });
          if (error) {
            console.error("Activity image upload error", error);
            return resolve(null);
          }
          const {
            data: { publicUrl },
          } = supabase.storage.from("posts-media").getPublicUrl(filename);
          resolve(publicUrl);
        } catch (e) {
          console.error(e);
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Upload exception", e);
    return null;
  }
}

// ====================================================================
// Styles
// ====================================================================

const makeStyles = (t: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  headerBtn: {
    padding: 8,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: t.colors.text },

  scrollContent: { padding: 16, paddingBottom: 120 },

  stepHeading: { fontSize: 22, fontWeight: "800", color: t.colors.text, marginBottom: 4 },
  stepSub: { fontSize: 14, color: t.colors.textSecondary, marginBottom: 18 },

  label: { fontSize: 13, fontWeight: "700", color: t.colors.text, marginTop: 14, marginBottom: 8 },
  helper: { fontSize: 11, color: "#888", marginTop: 4 },

  input: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: t.colors.text,
    backgroundColor: t.colors.inputBg,
  },
  textarea: { minHeight: 110, textAlignVertical: "top" },

  // Categories
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 6,
  },
  categoryCard: {
    width: "31%",
    borderWidth: 2,
    borderColor: t.colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: t.colors.surface,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  categoryLabel: { fontSize: 12, color: t.colors.text, fontWeight: "600" },

  // Location
  locationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    marginTop: 14,
    borderRadius: 12,
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  locationBtnText: { color: "#4CAF50", fontWeight: "700" },
  coordsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: t.colors.inputBg,
  },
  coordsText: { color: t.colors.text, fontSize: 13 },

  // Date/Time tiles
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    marginBottom: 10,
  },
  tileLabel: { fontSize: 12, color: t.colors.textSecondary, fontWeight: "600" },
  tileValue: { fontSize: 15, color: t.colors.text, fontWeight: "600" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  chipActive: { borderColor: "#4CAF50", backgroundColor: t.colors.inputBg },
  chipText: { color: t.colors.text, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: "#4CAF50" },

  // Stepper
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
    paddingVertical: 6,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: t.colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  stepperValue: { fontSize: 22, fontWeight: "800", color: t.colors.text, minWidth: 40, textAlign: "center" },

  // Options
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  optionRowActive: { borderColor: "#4CAF50", backgroundColor: t.colors.inputBg },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#555",
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: { fontSize: 14, fontWeight: "700", color: t.colors.text },
  optionSub: { fontSize: 12, color: t.colors.textSecondary },

  // Pricing
  toggleRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  toggleCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: t.colors.border,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    backgroundColor: t.colors.surface,
  },
  toggleActive: { borderColor: "#4CAF50", backgroundColor: t.colors.inputBg },
  toggleTitle: { fontSize: 16, fontWeight: "800", color: t.colors.text, marginTop: 6 },
  toggleSub: { fontSize: 12, color: t.colors.textSecondary },

  priceTierGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  priceTierBtn: {
    flex: 1,
    minWidth: 70,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: t.colors.border,
    backgroundColor: t.colors.inputBg,
    alignItems: "center",
  },
  priceTierBtnActive: {
    borderColor: "#4CAF50",
    backgroundColor: "#4CAF5022",
  },
  priceTierLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: t.colors.text,
  },
  priceTierLabelActive: {
    color: "#4CAF50",
  },

  feeBreakdown: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  feeRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  feeLabel: { fontSize: 13, fontWeight: "700", color: t.colors.text },
  feeValue: { fontSize: 13, fontWeight: "800", color: "#4CAF50" },
  feeLabelMuted: { fontSize: 12, color: "#888" },
  feeValueMuted: { fontSize: 12, color: "#888" },

  toggleSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
  },

  // Image
  imagePicker: {
    height: 180,
    borderRadius: 14,
    backgroundColor: t.colors.inputBg,
    borderWidth: 2,
    borderColor: t.colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  imagePreview: { width: "100%", height: "100%" },
  imagePlaceholder: { alignItems: "center", gap: 6 },
  imagePickerText: { color: "#4CAF50", fontWeight: "700" },
  removeImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 10,
  },
  removeImageText: { color: "#DC2626", fontWeight: "600" },

  fallbackBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: t.colors.inputBg,
  },
  fallbackImg: { width: 44, height: 44, borderRadius: 8 },
  fallbackText: { color: t.colors.textSecondary, fontSize: 12, flex: 1 },

  // Preview
  previewCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  previewImg: { width: "100%", height: 160, backgroundColor: t.colors.inputBg },
  previewBadgeRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  catChipText: { fontSize: 11, fontWeight: "700" },
  previewTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: t.colors.text,
    marginBottom: 10,
  },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  previewRowText: { fontSize: 13, color: t.colors.textSecondary },
  previewDesc: { fontSize: 13, color: t.colors.textSecondary, marginTop: 8, lineHeight: 18 },

  // Footer
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    backgroundColor: t.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
  primaryBtn: {
    flex: 2,
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  secondaryBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.inputBg,
  },
  secondaryBtnText: { color: t.colors.text, fontWeight: "700" },
  btnDisabled: { opacity: 0.4 },

  // Dots progress bar
  dotsBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: t.colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#222222",
  },
  dotsBarLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dotsLine: {
    flex: 1,
    height: 2,
    borderRadius: 1,
  },
  dotsLineGreen: { backgroundColor: "#4CAF50" },
  dotsLineGrey: { backgroundColor: t.colors.border },
  dotWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  dotWrapCurrent: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#4CAF50",
  },
  dotCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotCoreGreen: { backgroundColor: "#4CAF50" },
  dotCoreEmpty: {
    borderWidth: 2,
    borderColor: t.colors.border,
    backgroundColor: "transparent",
  },

  // Map & search (Step 2)
  searchRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: t.colors.text,
    backgroundColor: t.colors.inputBg,
  },
  searchBtn: {
    width: 46,
    borderRadius: 12,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
  },
  mapContainer: {
    height: 220,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 10,
    position: "relative",
  },
  map: { width: "100%", height: "100%" },
  mapOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    zIndex: 1,
  },
  mapOverlayText: { color: t.colors.text, fontWeight: "600" },
  locationInfoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: t.colors.inputBg,
    borderWidth: 1,
    borderColor: t.colors.border,
    marginTop: 2,
  },
  locationInfoName: { color: t.colors.text, fontWeight: "600", fontSize: 14 },
  locationInfoDist: { color: "#9CA3AF", fontSize: 12, marginTop: 2 },

  // Map tap hint overlay
  mapTapHint: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  mapTapHintText: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "600" },

  // Open full map button
  openMapBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  openMapBtnText: { color: "#4CAF50", fontWeight: "700", fontSize: 14 },

  // Full-screen map modal
  fullMapSafe: { flex: 1, backgroundColor: t.colors.background },
  fullMapHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  fullMapBackBtn: { padding: 8, width: 44, alignItems: "center" },
  fullMapTitle: { fontSize: 16, fontWeight: "700", color: t.colors.text },
  fullMapSearchRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: t.colors.background,
  },
  fullMapSearchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: t.colors.text,
    backgroundColor: t.colors.inputBg,
  },
  fullMapSearchBtn: {
    width: 46,
    borderRadius: 12,
    backgroundColor: "#4CAF50",
    alignItems: "center",
    justifyContent: "center",
  },
  fullMap: { flex: 1 },
  fullMapBottom: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: t.colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
    gap: 10,
  },
  fullMapLocationBar: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  fullMapLocationText: { flex: 1, color: t.colors.text, fontWeight: "600", fontSize: 14 },
  fullMapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  fullMapHintText: { flex: 1, color: t.colors.textSecondary, fontSize: 13 },
  fullMapConfirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#4CAF50",
  },
  fullMapConfirmText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
