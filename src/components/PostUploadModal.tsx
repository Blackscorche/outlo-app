import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme } from '../styles/theme';
import { supabase } from '../integrations/supabase/client';
import { showImagePickerOptions, showVideoPickerOptions } from '../utils/imagePicker';

interface PostUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

const PostUploadModal = ({ visible, onClose, onPostCreated }: PostUploadModalProps) => {
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);

  const pickMedia = async (type: 'photo' | 'video') => {
    if (type === 'photo') {
      showImagePickerOptions(
        {
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        },
        (uri) => {
          setMediaUri(uri);
          setMediaType(type);
        }
      );
    } else {
      showVideoPickerOptions((uri) => {
        setMediaUri(uri);
        setMediaType(type);
      });
    }
  };

  const uploadPost = async () => {
    if (!mediaUri) {
      Alert.alert('Error', 'Please select a photo or video');
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Upload media to storage
      const fileName = `${Date.now()}.${mediaType === 'photo' ? 'jpg' : 'mp4'}`;
      const filePath = `${user.id}/${fileName}`;

      const response = await fetch(mediaUri);
      const blob = await response.blob();
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          
          const decode = atob(base64Data);
          const arrayBuffer = new Uint8Array(decode.length);
          for (let i = 0; i < decode.length; i++) {
            arrayBuffer[i] = decode.charCodeAt(i);
          }
          
          const { error: uploadError } = await supabase.storage
            .from('posts-media')
            .upload(filePath, arrayBuffer.buffer, {
              contentType: mediaType === 'photo' ? 'image/jpeg' : 'video/mp4',
              cacheControl: '3600',
            });

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('posts-media')
            .getPublicUrl(filePath);

          // Create post record
          const { error: postError } = await supabase
            .from('posts')
            .insert({
              user_id: user.id,
              media_url: publicUrl,
              media_type: mediaType,
              caption: caption.trim(),
            });

          if (postError) throw postError;

          Alert.alert('Success', 'Post created successfully!');
          onPostCreated();
          
          // Reset modal
          setMediaUri(null);
          setMediaType(null);
          setCaption('');
        } catch (error) {
          console.error('Error uploading post:', error);
          Alert.alert('Error', 'Failed to upload post');
        }
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to create post');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Create Post</Text>
          <TouchableOpacity onPress={uploadPost} disabled={uploading || !mediaUri}>
            <Text style={[styles.doneButton, (!mediaUri || uploading) && styles.doneButtonDisabled]}>
              {uploading ? 'Uploading...' : 'Share'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {mediaUri ? (
            <View style={styles.mediaPreview}>
              <Image source={{ uri: mediaUri }} style={styles.previewImage} />
              <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => {
                  setMediaUri(null);
                  setMediaType(null);
                }}
              >
                <Ionicons name="close-circle" size={30} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.mediaOptions}>
              <TouchableOpacity 
                style={styles.mediaOption}
                onPress={() => pickMedia('photo')}
              >
                <Ionicons name="image" size={40} color={theme.colors.primary} />
                <Text style={styles.mediaOptionText}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.mediaOption}
                onPress={() => pickMedia('video')}
              >
                <Ionicons name="videocam" size={40} color={theme.colors.primary} />
                <Text style={styles.mediaOptionText}>Video</Text>
              </TouchableOpacity>
            </View>
          )}

          <TextInput
            style={styles.captionInput}
            placeholder="Write a caption..."
            value={caption}
            onChangeText={setCaption}
            multiline
            numberOfLines={3}
            maxLength={500}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
  },
  doneButton: {
    fontSize: theme.fontSize.base,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  doneButtonDisabled: {
    color: theme.colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  mediaPreview: {
    position: 'relative',
    marginBottom: theme.spacing.lg,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: theme.borderRadius.md,
  },
  removeButton: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
  },
  mediaOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  mediaOption: {
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    width: '40%',
  },
  mediaOptionText: {
    marginTop: theme.spacing.sm,
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
  },
  captionInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.base,
    minHeight: 100,
    textAlignVertical: 'top',
  },
});

export default PostUploadModal;