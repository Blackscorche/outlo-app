import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { showImagePickerOptions } from '../utils/imagePicker';
import { theme } from '../styles/theme';
import { commonStyles } from '../styles/common';
import { supabase } from '../integrations/supabase/client';

const INTERESTS_OPTIONS = [
  'Travel', 'Photography', 'Music', 'Sports', 'Art', 'Reading', 'Movies', 'Dancing',
  'Cooking', 'Gaming', 'Hiking', 'Fitness', 'Fashion', 'Food', 'Animals', 'Technology',
  'Nature', 'Coffee', 'Wine', 'Yoga', 'Running', 'Swimming', 'Cycling', 'Meditation'
];

const AuthScreen = ({ navigation }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Profile data for sign-up
  const [profileData, setProfileData] = useState({
    fullName: '',
    age: '',
    gender: '',
    bio: '',
    location: '',
    lookingFor: '',
    interests: [],
    avatar: null,
    photos: []
  });

  const updateProfileData = (key, value) => {
    setProfileData(prev => ({ ...prev, [key]: value }));
  };

  const toggleInterest = (interest) => {
    const newInterests = profileData.interests.includes(interest)
      ? profileData.interests.filter(i => i !== interest)
      : [...profileData.interests, interest];
    updateProfileData('interests', newInterests);
  };

  const pickAvatar = async () => {
    showImagePickerOptions(
      {
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      },
      (imageUri) => {
        console.log('Avatar selected:', imageUri);
        // Store local URI for now, will upload during account creation
        updateProfileData('avatar', imageUri);
      }
    );
  };

  const pickImage = async () => {
    if (profileData.photos.length >= 4) {
      Alert.alert('Limit reached', 'You can upload maximum 4 post images');
      return;
    }

    showImagePickerOptions(
      {
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      },
      (imageUri) => {
        console.log('Post image selected:', imageUri);
        // Store local URI for now, will upload during account creation
        updateProfileData('photos', [...profileData.photos, imageUri]);
      }
    );
  };

  const removePhoto = (index) => {
    const newPhotos = profileData.photos.filter((_, i) => i !== index);
    updateProfileData('photos', newPhotos);
  };

  const validateSignUpData = () => {
    if (!profileData.fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name');
      return false;
    }
    if (!profileData.age.trim() || parseInt(profileData.age) < 18) {
      Alert.alert('Error', 'Please enter a valid age (18+)');
      return false;
    }
    if (!profileData.gender) {
      Alert.alert('Error', 'Please select your gender');
      return false;
    }
    if (!profileData.bio.trim()) {
      Alert.alert('Error', 'Please write a short bio');
      return false;
    }
    if (!profileData.location.trim()) {
      Alert.alert('Error', 'Please enter your location');
      return false;
    }
    if (!profileData.lookingFor) {
      Alert.alert('Error', 'Please specify who you prefer to connect with');
      return false;
    }
    if (profileData.interests.length < 3) {
      Alert.alert('Error', 'Please select at least 3 interests');
      return false;
    }
    if (!profileData.avatar) {
      Alert.alert('Error', 'Please add a profile avatar');
      return false;
    }
    if (profileData.photos.length < 2) {
      Alert.alert('Error', 'Please add at least 2 post images');
      return false;
    }
    return true;
  };

  const uploadImageToStorage = async (imageUri, userId, bucket = 'user-photos') => {
    try {
      // Create a unique filename with user ID in the path
      const fileName = `${Date.now()}.jpeg`;
      const filePath = `${userId}/${fileName}`;

      console.log(`Starting image upload to ${bucket}:`, imageUri);

      // Convert image to base64
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64String = reader.result as string;
            const base64Data = base64String.split(',')[1];
            
            console.log('Converted to base64, uploading to Supabase...');
            
            // Decode base64 to array buffer
            const decode = atob(base64Data);
            const arrayBuffer = new Uint8Array(decode.length);
            for (let i = 0; i < decode.length; i++) {
              arrayBuffer[i] = decode.charCodeAt(i);
            }
            
            // Upload to Supabase with proper authentication
            const { data, error } = await supabase.storage
              .from(bucket)
              .upload(filePath, arrayBuffer.buffer, {
                contentType: 'image/jpeg',
                cacheControl: '3600',
                upsert: true // Allow overwriting if needed
              });

            if (error) {
              console.error('Supabase upload error:', error);
              
              if (error.message?.includes('row-level security policy')) {
                Alert.alert(
                  'Storage Permission Error',
                  `Please run the following SQL in your Supabase dashboard:\n\n` +
                  '1. Go to SQL Editor\n' +
                  '2. Create bucket if not exists:\n' +
                  `INSERT INTO storage.buckets (id, name, public) VALUES ('${bucket}', '${bucket}', true) ON CONFLICT DO NOTHING;\n\n` +
                  '3. Set RLS policies:\n' +
                  `CREATE POLICY "Anyone can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = '${bucket}');\n` +
                  `CREATE POLICY "Anyone can view" ON storage.objects FOR SELECT USING (bucket_id = '${bucket}');\n` +
                  `CREATE POLICY "Users can update own" ON storage.objects FOR UPDATE USING (bucket_id = '${bucket}' AND auth.uid()::text = owner);\n` +
                  `CREATE POLICY "Users can delete own" ON storage.objects FOR DELETE USING (bucket_id = '${bucket}' AND auth.uid()::text = owner);`
                );
              } else if (error.message?.includes('bucket') || error.message?.includes('not found')) {
                Alert.alert(
                  'Storage Setup Required',
                  `Please ensure the "${bucket}" storage bucket exists in your Supabase project.`
                );
              }
              throw error;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from(bucket)
              .getPublicUrl(filePath);

            console.log('Upload successful! URL:', publicUrl);
            resolve(publicUrl);
          } catch (error) {
            console.error('Error in base64 upload:', error);
            reject(error);
          }
        };
        
        reader.onerror = (error) => {
          console.error('FileReader error:', error);
          reject(error);
        };
        
        reader.readAsDataURL(blob);
      });

    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert(
        'Upload Failed',
        'Failed to upload image. Please check your internet connection and try again.'
      );
      return null;
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        // Validate sign-up data
        if (!validateSignUpData()) {
          setLoading(false);
          return;
        }

        // Sign up user without email confirmation
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: undefined, // Disable email verification
            data: {
              full_name: profileData.fullName,
            },
          },
        });

        if (signUpError) throw signUpError;

        if (authData.user) {
          // Upload avatar to Supabase Storage (user-photos bucket)
          console.log('Uploading avatar to Supabase...');
          const uploadedAvatar = await uploadImageToStorage(profileData.avatar, authData.user.id, 'user-photos');
          
          if (!uploadedAvatar) {
            Alert.alert(
              'Upload Failed',
              'Failed to upload avatar. Please check your internet connection and try again.'
            );
            setLoading(false);
            return;
          }

          // Upload post images to Supabase Storage (posts-media bucket)
          console.log('Uploading post images to Supabase...');
          const uploadedPhotos = [];
          for (const photo of profileData.photos) {
            const uploadedUrl = await uploadImageToStorage(photo, authData.user.id, 'posts-media');
            if (uploadedUrl) {
              uploadedPhotos.push(uploadedUrl);
            }
          }

          if (uploadedPhotos.length < 2) {
            Alert.alert(
              'Upload Failed',
              'Failed to upload post images. Please check your internet connection and try again.'
            );
            setLoading(false);
            return;
          }

          // Create profile with only avatar in photos array
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: authData.user.id,
              name: profileData.fullName,
              bio: profileData.bio,
              age: parseInt(profileData.age),
              gender: profileData.gender,
              location: profileData.location,
              looking_for: profileData.lookingFor,
              interests: profileData.interests,
              photos: [uploadedAvatar], // Only avatar in profile photos
              is_online: true,
              is_visible: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (profileError) throw profileError;

          console.log('Profile created successfully with avatar');

          // Create posts for each uploaded photo
          console.log('Creating posts for uploaded photos...');
          for (let i = 0; i < uploadedPhotos.length; i++) {
            const { error: postError } = await supabase
              .from('posts')
              .insert({
                user_id: authData.user.id,
                media_url: uploadedPhotos[i],
                media_type: 'photo',
                caption: i === 0 ? 'My first post!' : '',
                is_deleted: false,
                created_at: new Date().toISOString(),
              });

            if (postError) {
              console.error('Error creating post:', postError);
              // Continue creating other posts even if one fails
            }
          }

          console.log('Posts created successfully');
          Alert.alert('Welcome!', 'Your account has been created successfully! You can start using the app right away.');
        }
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>LoveMap</Text>
            <Text style={styles.subtitle}>
              {isLogin ? 'Welcome back!' : 'Create your complete profile'}
            </Text>
          </View>

          <View style={styles.form}>
            {/* Profile Avatar - Show first for sign up */}
            {!isLogin && (
              <View style={styles.section}>
                <View style={styles.avatarContainer}>
                  {profileData.avatar ? (
                    <View style={styles.avatarWrapper}>
                      <Image source={{ uri: profileData.avatar }} style={styles.avatar} />
                      <TouchableOpacity
                        style={styles.removeAvatar}
                        onPress={() => updateProfileData('avatar', null)}
                      >
                        <Ionicons name="close" size={16} color="white" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addAvatar} onPress={pickAvatar}>
                      <Ionicons name="person" size={40} color={theme.colors.primary} />
                      <Text style={styles.addAvatarText}>Add Avatar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Login Fields */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Account Details</Text>
              
              {!isLogin && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your full name"
                    placeholderTextColor={theme.colors.textSecondary}
                    value={profileData.fullName}
                    onChangeText={(text) => updateProfileData('fullName', text)}
                    autoCapitalize="words"
                  />
                </View>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            {/* Profile Fields for Sign Up */}
            {!isLogin && (
              <>
                {/* Basic Info */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Basic Information</Text>
                  
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Age</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your age"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={profileData.age}
                      onChangeText={(text) => updateProfileData('age', text)}
                      keyboardType="numeric"
                      maxLength={2}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Gender</Text>
                    <View style={styles.optionsRow}>
                      {[
                        { display: 'Man', value: 'male' },
                        { display: 'Woman', value: 'female' },
                        { display: 'Other', value: 'other' }
                      ].map((gender) => (
                        <TouchableOpacity
                          key={gender.value}
                          style={[
                            styles.optionChip,
                            profileData.gender === gender.value && styles.optionChipSelected
                          ]}
                          onPress={() => updateProfileData('gender', gender.value)}
                        >
                          <Text style={[
                            styles.optionText,
                            profileData.gender === gender.value && styles.optionTextSelected
                          ]}>
                            {gender.display}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Location</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your city"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={profileData.location}
                      onChangeText={(text) => updateProfileData('location', text)}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Prefer to connect with</Text>
                    <View style={styles.optionsRow}>
                      {[
                        { display: 'Men', value: 'men' },
                        { display: 'Women', value: 'women' },
                        { display: 'Everyone', value: 'everyone' }
                      ].map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.optionChip,
                            profileData.lookingFor === option.value && styles.optionChipSelected
                          ]}
                          onPress={() => updateProfileData('lookingFor', option.value)}
                        >
                          <Text style={[
                            styles.optionText,
                            profileData.lookingFor === option.value && styles.optionTextSelected
                          ]}>
                            {option.display}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Bio */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>About You</Text>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Bio</Text>
                    <TextInput
                      style={[styles.input, styles.bioInput]}
                      placeholder="What activities do you enjoy? What are you looking to do?"
                      placeholderTextColor={theme.colors.textSecondary}
                      value={profileData.bio}
                      onChangeText={(text) => updateProfileData('bio', text)}
                      multiline
                      numberOfLines={4}
                      maxLength={500}
                    />
                  </View>
                </View>

                {/* Post Images */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Post Images (Add at least 2)</Text>
                  <View style={styles.photosGrid}>
                    {profileData.photos.map((photo, index) => (
                      <View key={index} style={styles.photoContainer}>
                        <Image source={{ uri: photo }} style={styles.photo} />
                        <TouchableOpacity
                          style={styles.removePhoto}
                          onPress={() => removePhoto(index)}
                        >
                          <Ionicons name="close" size={16} color="white" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {profileData.photos.length < 4 && (
                      <TouchableOpacity style={styles.addPhoto} onPress={pickImage}>
                        <Ionicons name="camera" size={30} color={theme.colors.primary} />
                        <Text style={styles.addPhotoText}>Add Image</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Interests */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Interests (Select at least 3)</Text>
                  <View style={styles.interestsGrid}>
                    {INTERESTS_OPTIONS.map((interest) => (
                      <TouchableOpacity
                        key={interest}
                        style={[
                          styles.interestChip,
                          profileData.interests.includes(interest) && styles.interestChipSelected
                        ]}
                        onPress={() => toggleInterest(interest)}
                      >
                        <Text style={[
                          styles.interestText,
                          profileData.interests.includes(interest) && styles.interestTextSelected
                        ]}>
                          {interest}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.buttonText}>
                    {isLogin ? 'Signing in...' : 'Creating account & uploading photos...'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.buttonText}>
                  {isLogin ? 'Sign In' : 'Create Account'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchMode}
              onPress={() => setIsLogin(!isLogin)}
            >
              <Text style={styles.switchModeText}>
                {isLogin
                  ? "Don't have an account? Sign Up"
                  : 'Already have an account? Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  inputContainer: {
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.base,
    color: theme.colors.text,
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  optionChip: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  optionChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  optionTextSelected: {
    color: 'white',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  photoContainer: {
    width: 80,
    height: 80,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: theme.borderRadius.md,
  },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 2,
  },
  addPhoto: {
    width: 80,
    height: 80,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
  addPhotoText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.xs,
    marginTop: 4,
    textAlign: 'center',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: theme.colors.primary,
  },
  removeAvatar: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 2,
  },
  addAvatar: {
    width: 120,
    height: 120,
    backgroundColor: theme.colors.background,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
  },
  addAvatarText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.xs,
    marginTop: 4,
    textAlign: 'center',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  interestChip: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  interestChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  interestText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  interestTextSelected: {
    color: 'white',
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  buttonText: {
    color: 'white',
    fontSize: theme.fontSize.base,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  switchMode: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  switchModeText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.base,
  },
});

export default AuthScreen;