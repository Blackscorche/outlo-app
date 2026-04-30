import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
interface MapFiltersProps {
  visible: boolean;
  onClose: () => void;
  filters: {
    genderPreference: 'Everyone' | 'Men' | 'Women';
    maxDistance: number;
    minAge: number;
    maxAge: number;
  };
  onFiltersChange: (filters: any) => void;
}

export default function MapFilters({ visible, onClose, filters, onFiltersChange }: MapFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);

  const updateFilter = (key: string, value: any) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const resetFilters = () => {
    const defaultFilters = {
      genderPreference: 'Men' as const,
      maxDistance: 50,
      minAge: 18,
      maxAge: 100,
    };
    setLocalFilters(defaultFilters);
    onFiltersChange(defaultFilters);
  };
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Activity Partner Filters</Text>
          <TouchableOpacity onPress={resetFilters}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Gender Preference */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Prefer to connect with</Text>
            <View style={styles.optionsContainer}>
              {['Men', 'Women'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    localFilters.genderPreference === option && styles.optionButtonSelected
                  ]}
                  onPress={() => updateFilter('genderPreference', option)}
                >
                  <Text style={[
                    styles.optionText,
                    localFilters.genderPreference === option && styles.optionTextSelected
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Distance */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Search Radius: {localFilters.maxDistance} km
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={100}
              value={localFilters.maxDistance}
              onValueChange={(value) => updateFilter('maxDistance', Math.round(value))}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.gray[300]}

            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>1 km</Text>
              <Text style={styles.sliderLabel}>100 km</Text>
            </View>
          </View>

          {/* Age Range - Fixed */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Activity Partner Age Range
            </Text>
            <Text style={styles.ageDisabledText}>
              Age filtering is currently disabled. All activity partners (18-100) are shown.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={applyFilters}
          >
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (t: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: t.colors.text,
  },
  resetText: {
    color: t.colors.primary,
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginVertical: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: t.colors.text,
    marginBottom: 16,
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  optionButton: {
    flex: 1,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  optionButtonSelected: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  optionText: {
    fontSize: 16,
    color: t.colors.text,
  },
  optionTextSelected: {
    color: 'white',
  },
  slider: {
    height: 40,
  },
  sliderThumb: {
    backgroundColor: t.colors.primary,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 14,
    color: t.colors.textSecondary,
  },
  ageContainer: {
    gap: 20,
  },
  ageSliderContainer: {
    gap: 8,
  },
  ageLabel: {
    fontSize: 16,
    color: t.colors.text,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  applyButton: {
    backgroundColor: t.colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  ageDisabledText: {
    fontSize: 14,
    color: t.colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
});