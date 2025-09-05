import React, { useState, useEffect, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

interface ImagePickerOptions {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
  mediaTypes?: ImagePicker.MediaTypeOptions;
}

// Global state management for the modal
class ModalManager {
  private static instance: ModalManager;
  private showModalCallback: ((options: any) => void) | null = null;

  static getInstance(): ModalManager {
    if (!ModalManager.instance) {
      ModalManager.instance = new ModalManager();
    }
    return ModalManager.instance;
  }

  setShowModalCallback(callback: (options: any) => void) {
    this.showModalCallback = callback;
  }

  showModal(options: any) {
    if (this.showModalCallback) {
      this.showModalCallback(options);
    }
  }
}

const modalManager = ModalManager.getInstance();

export const ImagePickerModal = () => {
  const [visible, setVisible] = useState(false);
  const [pickerOptions, setPickerOptions] = useState<ImagePickerOptions>({});
  const [onImageSelected, setOnImageSelected] = useState<(uri: string) => void>(() => () => {});
  const [isVideo, setIsVideo] = useState(false);

  useEffect(() => {
    modalManager.setShowModalCallback(({ options, callback, video }) => {
      setPickerOptions(options);
      setOnImageSelected(() => callback);
      setIsVideo(video || false);
      setVisible(true);
    });
  }, []);

  const handleCamera = async () => {
    try {
      // Request camera permissions
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraPermission.status !== 'granted') {
        Alert.alert('Permission Denied', `Camera permission is required to ${isVideo ? 'record videos' : 'take photos'}`);
        return;
      }

      // For Android, also check media library permissions
      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (mediaPermission.status !== 'granted') {
        Alert.alert('Permission Denied', 'Media library permission is required');
        return;
      }

      // Launch camera with explicit configuration
      const result = await ImagePicker.launchCameraAsync({
        ...pickerOptions,
        allowsEditing: pickerOptions.allowsEditing ?? true,
        aspect: pickerOptions.aspect ?? [1, 1],
        quality: pickerOptions.quality ?? 0.8,
        mediaTypes: pickerOptions.mediaTypes ?? ImagePicker.MediaTypeOptions.Images,
      });
      
      if (!result.canceled && result.assets && result.assets[0]) {
        onImageSelected(result.assets[0].uri);
        setVisible(false);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera. Please ensure camera app is installed and permissions are granted.');
    }
  };

  const handleGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      if (!result.canceled && result.assets[0]) {
        onImageSelected(result.assets[0].uri);
        setVisible(false);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to open gallery');
    }
  };

  const handleClose = () => {
    setVisible(false);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={handleClose}
      >
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Select {isVideo ? 'Video' : 'Photo'}</Text>
          <Text style={styles.subtitle}>Choose from where you want to select a {isVideo ? 'video' : 'photo'}</Text>
          
          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.option} onPress={handleCamera}>
              <View style={styles.iconContainer}>
                <Ionicons name="camera" size={40} color={theme.colors.primary} />
              </View>
              <Text style={styles.optionText}>Camera</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.option} onPress={handleGallery}>
              <View style={styles.iconContainer}>
                <Ionicons name="images" size={40} color={theme.colors.primary} />
              </View>
              <Text style={styles.optionText}>Gallery</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export const showImagePickerOptions = async (
  options: ImagePickerOptions = {},
  onImageSelected: (uri: string) => void
) => {
  const defaultOptions = {
    allowsEditing: true,
    aspect: [1, 1] as [number, number],
    quality: 0.8,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    ...options,
  };

  modalManager.showModal({
    options: defaultOptions,
    callback: onImageSelected,
    video: false,
  });
};

export const showVideoPickerOptions = async (
  onVideoSelected: (uri: string) => void
) => {
  const options = {
    mediaTypes: ImagePicker.MediaTypeOptions.Videos,
    allowsEditing: true,
    quality: 0.8,
  };

  modalManager.showModal({
    options,
    callback: onVideoSelected,
    video: true,
  });
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '85%',
    maxWidth: 350,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.lg,
  },
  option: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  optionText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
    fontWeight: '500',
  },
  cancelButton: {
    alignSelf: 'flex-end',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  cancelText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});