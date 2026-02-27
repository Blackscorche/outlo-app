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
  ImageBackground,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { showImagePickerOptions } from '../utils/imagePicker';
import { theme } from '../styles/theme';
import { commonStyles } from '../styles/common';
import { supabase } from '../integrations/supabase/client';

GoogleSignin.configure({
  webClientId: '447020157078-j7dgtcldvhhom3tbbshbm4hhg0k9pg9j.apps.googleusercontent.com',
  iosClientId: '447020157078-5erck39597ss1lohdc4vjc809di4g3bc.apps.googleusercontent.com',
});

const INTERESTS_OPTIONS = [
  { label: 'Travel', icon: 'airplane' as const },
  { label: 'Photography', icon: 'camera' as const },
  { label: 'Music', icon: 'musical-notes' as const },
  { label: 'Sports', icon: 'football' as const },
  { label: 'Art', icon: 'color-palette' as const },
  { label: 'Reading', icon: 'book' as const },
  { label: 'Movies', icon: 'film' as const },
  { label: 'Dancing', icon: 'body' as const },
  { label: 'Cooking', icon: 'restaurant' as const },
  { label: 'Gaming', icon: 'game-controller' as const },
  { label: 'Hiking', icon: 'walk' as const },
  { label: 'Fitness', icon: 'barbell' as const },
  { label: 'Fashion', icon: 'shirt' as const },
  { label: 'Food', icon: 'fast-food' as const },
  { label: 'Animals', icon: 'paw' as const },
  { label: 'Technology', icon: 'laptop' as const },
  { label: 'Nature', icon: 'leaf' as const },
  { label: 'Coffee', icon: 'cafe' as const },
  { label: 'Wine', icon: 'wine' as const },
  { label: 'Yoga', icon: 'accessibility' as const },
  { label: 'Running', icon: 'speedometer' as const },
  { label: 'Swimming', icon: 'water' as const },
  { label: 'Cycling', icon: 'bicycle' as const },
  { label: 'Meditation', icon: 'rose' as const }
];

const AuthScreen = ({ navigation }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [signupStep, setSignupStep] = useState(1); // 1: Basic Info, 2: Profile Details, 3: Photos & Interests

  // Profile data for sign-up
  const [profileData, setProfileData] = useState<{
    fullName: string;
    age: string;
    gender: string;
    bio: string;
    location: string;
    lookingFor: string;
    interests: string[];
    avatar: string | null;
    photos: string[];
  }>({
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
          // Show email verification notice
          setVerifyEmail(email);
          setShowVerifyModal(true);
        }
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      const idToken = response?.data?.idToken;
      if (!idToken) throw new Error('No ID token from Google');

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) throw error;
    } catch (error: any) {
      if (error.code !== 'SIGN_IN_CANCELLED') {
        Alert.alert('Google Sign In Failed', error.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <>
    <ImageBackground
      source={require('../../assets/background.png')}
      style={styles.backgroundImage}
      resizeMode="contain"
      imageStyle={{ opacity: 0.95 }}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Back Button - Show only in signup mode */}
            {!isLogin && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setIsLogin(true)}
              >
                <Ionicons name="arrow-back" size={24} color="#333" />
              </TouchableOpacity>
            )}

            {/* Logo Header */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/adaptive-icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

          <View style={styles.form}>
            {isLogin ? (
              // Login Form
              <>
                <View style={styles.loginSection}>
                  <Text style={styles.welcomeText}>Welcome Back</Text>

                  <Text style={styles.inputLabel}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputField}
                      placeholder="Enter your email"
                      placeholderTextColor="#999"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>

                  <Text style={styles.inputLabel}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                    <TextInput
                      style={styles.inputField}
                      placeholder="Enter your password"
                      placeholderTextColor="#999"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeIcon}
                    >
                      <Ionicons
                        name={showPassword ? "eye-outline" : "eye-off-outline"}
                        size={20}
                        color="#999"
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.rememberRow}>
                    <TouchableOpacity
                      style={styles.rememberContainer}
                      onPress={() => setRememberMe(!rememberMe)}
                    >
                      <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                        {rememberMe && <Ionicons name="checkmark" size={14} color="white" />}
                      </View>
                      <Text style={styles.rememberText}>Remember me</Text>
                    </TouchableOpacity>
                    <TouchableOpacity>
                      <Text style={styles.forgotText}>Forgot password?</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.signInButton, loading && styles.buttonDisabled]}
                    onPress={handleAuth}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.signInButtonText}>Sign In</Text>
                    )}
                  </TouchableOpacity>

                  <Text style={styles.orText}>Or continue with</Text>

                  <View style={styles.socialButtons}>
                    <TouchableOpacity
                      style={styles.socialButton}
                      onPress={handleGoogleLogin}
                      disabled={googleLoading}
                    >
                      {googleLoading
                        ? <ActivityIndicator size="small" color="#DB4437" />
                        : <Ionicons name="logo-google" size={20} color="#DB4437" />
                      }
                      <Text style={styles.socialButtonText}>Google</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.socialButton}>
                      <Ionicons name="logo-apple" size={20} color="#000000" />
                      <Text style={styles.socialButtonText}>Apple</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.signUpPrompt}>
                    <Text style={styles.signUpText}>Don't have an account? </Text>
                    <TouchableOpacity onPress={() => setIsLogin(false)}>
                      <Text style={styles.signUpLink}>Sign up</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : (
              // Modern Sign Up Form
              <View style={styles.signupContainer}>
                  {/* Avatar Upload */}
                <View style={styles.modernAvatarSection}>
                  <TouchableOpacity style={styles.modernAvatarButton} onPress={pickAvatar}>
                    {profileData.avatar ? (
                      <>
                        <Image source={{ uri: profileData.avatar }} style={styles.modernAvatar} />
                        <TouchableOpacity
                          style={styles.modernRemoveAvatar}
                          onPress={() => updateProfileData('avatar', null)}
                        >
                          <Ionicons name="close-circle" size={28} color="#FF1744" />
                        </TouchableOpacity>
                      </>
                    ) : (
                      <View style={styles.modernAvatarPlaceholder}>
                        <Ionicons name="camera" size={32} color="#FF1744" />
                        <Text style={styles.modernAvatarText}>Add Photo</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Account Info */}
                <View style={styles.modernInputGroup}>
                  <View style={styles.modernInputWrapper}>
                    <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                    <TextInput
                      style={styles.modernInput}
                      placeholder="Full Name"
                      placeholderTextColor="#999"
                      value={profileData.fullName}
                      onChangeText={(text) => updateProfileData('fullName', text)}
                      autoCapitalize="words"
                    />
                  </View>

                  <View style={styles.modernInputWrapper}>
                    <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                    <TextInput
                      style={styles.modernInput}
                      placeholder="Email Address"
                      placeholderTextColor="#999"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>

                  <View style={styles.modernInputWrapper}>
                    <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                    <TextInput
                      style={styles.modernInput}
                      placeholder="Password"
                      placeholderTextColor="#999"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                      <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#999" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modernInputWrapper}>
                    <Ionicons name="calendar-outline" size={20} color="#999" style={styles.inputIcon} />
                    <TextInput
                      style={styles.modernInput}
                      placeholder="Age"
                      placeholderTextColor="#999"
                      value={profileData.age}
                      onChangeText={(text) => updateProfileData('age', text)}
                      keyboardType="numeric"
                      maxLength={2}
                    />
                  </View>

                  <View style={styles.modernInputWrapper}>
                    <Ionicons name="location-outline" size={20} color="#999" style={styles.inputIcon} />
                    <TextInput
                      style={styles.modernInput}
                      placeholder="City"
                      placeholderTextColor="#999"
                      value={profileData.location}
                      onChangeText={(text) => updateProfileData('location', text)}
                    />
                  </View>
                </View>

                {/* Gender Selection */}
                <View style={styles.modernSection}>
                  <Text style={styles.modernLabel}>I am</Text>
                  <View style={styles.modernOptionsRow}>
                    {[
                      { display: 'Man', value: 'male', icon: 'male' },
                      { display: 'Woman', value: 'female', icon: 'female' },
                      { display: 'Other', value: 'other', icon: 'male-female' }
                    ].map((gender) => (
                      <TouchableOpacity
                        key={gender.value}
                        style={[
                          styles.modernOptionCard,
                          profileData.gender === gender.value && styles.modernOptionCardSelected
                        ]}
                        onPress={() => updateProfileData('gender', gender.value)}
                      >
                        <Ionicons
                          name={gender.icon}
                          size={24}
                          color={profileData.gender === gender.value ? '#FFF' : '#FF1744'}
                        />
                        <Text style={[
                          styles.modernOptionText,
                          profileData.gender === gender.value && styles.modernOptionTextSelected
                        ]}>
                          {gender.display}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Looking For */}
                <View style={styles.modernSection}>
                  <Text style={styles.modernLabel}>I want to meet</Text>
                  <View style={styles.modernOptionsRow}>
                    {[
                      { display: 'Men', value: 'men' },
                      { display: 'Women', value: 'women' },
                      { display: 'Everyone', value: 'everyone' }
                    ].map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.modernOptionCard,
                          profileData.lookingFor === option.value && styles.modernOptionCardSelected
                        ]}
                        onPress={() => updateProfileData('lookingFor', option.value)}
                      >
                        <Text style={[
                          styles.modernOptionText,
                          profileData.lookingFor === option.value && styles.modernOptionTextSelected
                        ]}>
                          {option.display}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Bio */}
                <View style={styles.modernSection}>
                  <Text style={styles.modernLabel}>About Me</Text>
                  <TextInput
                    style={styles.modernBioInput}
                    placeholder="Tell us about yourself, your interests, what you're looking for..."
                    placeholderTextColor="#999"
                    value={profileData.bio}
                    onChangeText={(text) => updateProfileData('bio', text)}
                    multiline
                    numberOfLines={4}
                    maxLength={500}
                    textAlignVertical="top"
                  />
                  <Text style={styles.charCount}>{profileData.bio.length}/500</Text>
                </View>

                {/* Photos */}
                <View style={styles.modernSection}>
                  <Text style={styles.modernLabel}>Add Photos (Min. 2)</Text>
                  <View style={styles.modernPhotosGrid}>
                    {profileData.photos.map((photo, index) => (
                      <View key={index} style={styles.modernPhotoItem}>
                        <Image source={{ uri: photo }} style={styles.modernPhoto} />
                        <TouchableOpacity
                          style={styles.modernRemovePhoto}
                          onPress={() => removePhoto(index)}
                        >
                          <Ionicons name="close-circle" size={24} color="#FF1744" />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {profileData.photos.length < 4 && (
                      <TouchableOpacity style={styles.modernAddPhoto} onPress={pickImage}>
                        <Ionicons name="add-circle" size={48} color="#FF1744" />
                        <Text style={styles.modernAddPhotoText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Interests */}
                <View style={styles.modernSection}>
                  <Text style={styles.modernLabel}>My Interests (Select at least 3)</Text>
                  <View style={styles.modernInterestsGrid}>
                    {INTERESTS_OPTIONS.map((interest) => (
                      <TouchableOpacity
                        key={interest.label}
                        style={[
                          styles.modernInterestChip,
                          profileData.interests.includes(interest.label) && styles.modernInterestChipSelected
                        ]}
                        onPress={() => toggleInterest(interest.label)}
                      >
                        <Ionicons
                          name={interest.icon}
                          size={16}
                          color={profileData.interests.includes(interest.label) ? '#FFF' : '#FF1744'}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[
                          styles.modernInterestText,
                          profileData.interests.includes(interest.label) && styles.modernInterestTextSelected
                        ]}>
                          {interest.label}
                        </Text>
                        {profileData.interests.includes(interest.label) && (
                          <Ionicons name="checkmark-circle" size={16} color="#FFF" style={{ marginLeft: 6 }} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Sign Up Button */}
                <TouchableOpacity
                  style={[styles.modernSignupButton, loading && styles.buttonDisabled]}
                  onPress={handleAuth}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Text style={styles.modernSignupButtonText}>Create Account</Text>
                      <Ionicons name="arrow-forward" size={20} color="white" />
                    </>
                  )}
                </TouchableOpacity>

                {/* Sign In Link */}
                <View style={styles.signUpPrompt}>
                  <Text style={styles.signUpText}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => setIsLogin(true)}>
                    <Text style={styles.signUpLink}>Sign In</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </ImageBackground>

      {/* ── EMAIL VERIFICATION MODAL ── */}
      <Modal visible={showVerifyModal} transparent animationType="fade">
        <View style={styles.verifyOverlay}>
          <View style={styles.verifyCard}>
            <View style={styles.verifyIconCircle}>
              <Ionicons name="mail-outline" size={36} color={theme.colors.primary} />
            </View>
            <Text style={styles.verifyTitle}>Verify your email</Text>
            <Text style={styles.verifyBody}>
              We sent a verification link to{'\n'}
              <Text style={styles.verifyEmailText}>{verifyEmail}</Text>
            </Text>
            <Text style={styles.verifyHint}>
              Please check your inbox and click the link to activate your account.
            </Text>
            <TouchableOpacity
              style={styles.verifyBtn}
              onPress={() => setShowVerifyModal(false)}
            >
              <Text style={styles.verifyBtnText}>Got it</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                await supabase.auth.resend({ type: 'signup', email: verifyEmail });
                Alert.alert('Sent', 'Verification email resent.');
              }}
            >
              <Text style={styles.verifyResend}>Resend email</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 100,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 10,
    position: 'relative',
    height: 180,
    justifyContent: 'center',
  },
  decorativeElements: {
    position: 'absolute',
    width: '130%',
    height: '100%',
    left: '-15%',
  },
  decorIcon: {
    position: 'absolute',
    opacity: 0.7,
  },
  logo: {
    height: 400,
    zIndex: 10,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 28,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  loginSection: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    marginHorizontal: 4,
  },
  inputLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 12,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  eyeIcon: {
    padding: 4,
  },
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  rememberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#DDD',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  rememberText: {
    fontSize: 14,
    color: '#666',
  },
  forgotText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  signInButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 25,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  signInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  orText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    marginBottom: 16,
  },
  socialButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  socialButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  signUpPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 14,
    color: '#666',
  },
  signUpLink: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
  },
  title: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    textAlign: 'center',
    fontWeight: '500',
  },
  form: {
    width: '100%',
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
  // Modern Signup Styles
  backButton: {
    position: 'absolute',
    top: 0,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  signupContainer: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    marginHorizontal: 4,
  },
  signupTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  signupSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  modernAvatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modernAvatarButton: {
    position: 'relative',
  },
  modernAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  modernAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF1744',
    borderStyle: 'dashed',
  },
  modernAvatarText: {
    fontSize: 12,
    color: '#FF1744',
    marginTop: 4,
    fontWeight: '500',
  },
  modernRemoveAvatar: {
    position: 'absolute',
    top: -5,
    right: -5,
  },
  modernInputGroup: {
    marginBottom: 20,
  },
  modernInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 50,
  },
  modernInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  modernSection: {
    marginBottom: 24,
  },
  modernLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  modernOptionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modernOptionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 6,
  },
  modernOptionCardSelected: {
    backgroundColor: '#FF1744',
    borderColor: '#FF1744',
  },
  modernOptionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  modernOptionTextSelected: {
    color: '#FFF',
  },
  modernBioInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  modernPhotosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modernPhotoItem: {
    width: '47%',
    aspectRatio: 1,
    position: 'relative',
  },
  modernPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  modernRemovePhoto: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  modernAddPhoto: {
    width: '47%',
    aspectRatio: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF1744',
    borderStyle: 'dashed',
  },
  modernAddPhotoText: {
    fontSize: 13,
    color: '#FF1744',
    fontWeight: '500',
    marginTop: 4,
  },
  modernInterestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modernInterestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 4,
  },
  modernInterestChipSelected: {
    backgroundColor: '#FF1744',
    borderColor: '#FF1744',
  },
  modernInterestText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  modernInterestTextSelected: {
    color: '#FFF',
  },
  modernSignupButton: {
    backgroundColor: '#FF1744',
    borderRadius: 25,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
    shadowColor: '#FF1744',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    gap: 8,
  },
  modernSignupButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },

  // Email verification modal
  verifyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  verifyCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
  },
  verifyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF0F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
  },
  verifyBody: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  verifyEmailText: {
    fontWeight: '600',
    color: theme.colors.text,
  },
  verifyHint: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  verifyBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  verifyBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  verifyResend: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
  },
});

export default AuthScreen;