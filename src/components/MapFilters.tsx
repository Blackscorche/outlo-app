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
import { theme } from '../styles/theme';

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
      genderPreference: 'Everyone' as const,
      maxDistance: 50,
      minAge: 18,
      maxAge: 65,
    };
    setLocalFilters(defaultFilters);
    onFiltersChange(defaultFilters);
  };

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
          <Text style={styles.title}>Filters</Text>
          <TouchableOpacity onPress={resetFilters}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Gender Preference */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Show me</Text>
            <View style={styles.optionsContainer}>
              {['Everyone', 'Men', 'Women'].map((option) => (
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
              Distance: {localFilters.maxDistance} km
            </Text>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={100}
              value={localFilters.maxDistance}
              onValueChange={(value) => updateFilter('maxDistance', Math.round(value))}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.gray[300]}
              thumbStyle={styles.sliderThumb}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>1 km</Text>
              <Text style={styles.sliderLabel}>100 km</Text>
            </View>
          </View>

          {/* Age Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Age: {localFilters.minAge} - {localFilters.maxAge}
            </Text>
            
            <View style={styles.ageContainer}>
              <View style={styles.ageSliderContainer}>
                <Text style={styles.ageLabel}>Min Age: {localFilters.minAge}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={18}
                  maximumValue={65}
                  value={localFilters.minAge}
                  onValueChange={(value) => {
                    const newMinAge = Math.round(value);
                    updateFilter('minAge', newMinAge);
                    if (newMinAge > localFilters.maxAge) {
                      updateFilter('maxAge', newMinAge);
                    }
                  }}
                  minimumTrackTintColor={theme.colors.primary}
                  maximumTrackTintColor={theme.colors.gray[300]}
                />
              </View>
              
              <View style={styles.ageSliderContainer}>
                <Text style={styles.ageLabel}>Max Age: {localFilters.maxAge}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={18}
                  maximumValue={65}
                  value={localFilters.maxAge}
                  onValueChange={(value) => {
                    const newMaxAge = Math.round(value);
                    updateFilter('maxAge', newMaxAge);
                    if (newMaxAge < localFilters.minAge) {
                      updateFilter('minAge', newMaxAge);
                    }
                  }}
                  minimumTrackTintColor={theme.colors.primary}
                  maximumTrackTintColor={theme.colors.gray[300]}
                />
              </View>
            </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  resetText: {
    color: theme.colors.primary,
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
    color: theme.colors.text,
    marginBottom: 16,
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  optionButton: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  optionButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  optionTextSelected: {
    color: 'white',
  },
  slider: {
    height: 40,
  },
  sliderThumb: {
    backgroundColor: theme.colors.primary,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  ageContainer: {
    gap: 20,
  },
  ageSliderContainer: {
    gap: 8,
  },
  ageLabel: {
    fontSize: 16,
    color: theme.colors.text,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  applyButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});