import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../integrations/supabase/client';
import { theme } from '../styles/theme';

const INTERESTS_OPTIONS = [
  'Travel', 'Photography', 'Music', 'Sports', 'Art', 'Reading', 'Movies', 'Dancing',
  'Cooking', 'Gaming', 'Hiking', 'Fitness', 'Fashion', 'Food', 'Animals', 'Technology',
  'Nature', 'Coffee', 'Wine', 'Yoga', 'Running', 'Swimming', 'Cycling', 'Meditation',
  'Shopping', 'Concerts', 'Theater', 'Museums', 'Beaches', 'Mountains', 'Cities',
  'Adventure', 'Learning', 'Volunteering', 'Gardening', 'DIY', 'Entrepreneurship'
];

const RELATIONSHIP_GOALS = [
  'Looking for Love',
  'Something Casual',
  'New Friends',
  'Networking',
  'Marriage',
  'Fun & Adventure'
];

interface OnboardingData {
  photos: string[];
  interests: string[];
  name: string;
  bio: string;
  location: string;
  age: string;
  gender: string;
  lookingFor: string;
  relationshipGoals: string[];
}

export default function OnboardingScreen({ navigation }: any) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    photos: [],
    interests: [],
    name: '',
    bio: '',
    location: '',
    age: '',
    gender: '',
    lookingFor: '',
    relationshipGoals: [],
  });

  const totalSteps = 8;

  const updateData = (key: keyof OnboardingData, value: any) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: return data.photos.length >= 2;
      case 1: return data.interests.length >= 5;
      case 2: return data.name.trim().length > 0;
      case 3: return data.bio.trim().length > 0;
      case 4: return data.location.trim().length > 0;
      case 5: return data.age.trim().length > 0 && parseInt(data.age) >= 18;
      case 6: return data.gender.length > 0;
      case 7: return data.lookingFor.length > 0;
      default: return true;
    }
  };

  const pickImage = async () => {
    if (data.photos.length >= 6) {
      Alert.alert('Limit reached', 'You can upload maximum 6 photos');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setLoading(true);
        const imageUri = result.assets[0].uri;
        console.log('Image selected:', imageUri);
        
        // Upload to Supabase Storage immediately
        const uploadedUrl = await uploadImageToStorage(imageUri);
        
        if (uploadedUrl) {
          console.log('Image uploaded successfully, adding to photos array');
          updateData('photos', [...data.photos, uploadedUrl]);
        } else {
          Alert.alert(
            'Upload Required',
            'Images must be uploaded to continue. Please try again or check your internet connection.'
          );
        }
        
        setLoading(false);
      }
    } catch (error) {
      console.error('Error picking/uploading image:', error);
      Alert.alert('Error', 'Failed to select or upload image');
      setLoading(false);
    }
  };

  const uploadImageToStorage = async (imageUri: string): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Create a unique filename with user ID in the path
      const fileName = `${Date.now()}.jpeg`;
      const filePath = `${user.id}/${fileName}`;

      console.log('Starting image upload:', imageUri);

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
              .from('user-photos')
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
                  'Please run the following SQL in your Supabase dashboard:\n\n' +
                  '1. Go to SQL Editor\n' +
                  '2. Create bucket if not exists:\n' +
                  "INSERT INTO storage.buckets (id, name, public) VALUES ('user-photos', 'user-photos', true) ON CONFLICT DO NOTHING;\n\n" +
                  '3. Set RLS policies:\n' +
                  "CREATE POLICY \"Anyone can upload\" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'user-photos');\n" +
                  "CREATE POLICY \"Anyone can view\" ON storage.objects FOR SELECT USING (bucket_id = 'user-photos');\n" +
                  "CREATE POLICY \"Users can update own\" ON storage.objects FOR UPDATE USING (bucket_id = 'user-photos' AND auth.uid()::text = owner);\n" +
                  "CREATE POLICY \"Users can delete own\" ON storage.objects FOR DELETE USING (bucket_id = 'user-photos' AND auth.uid()::text = owner);"
                );
              } else if (error.message?.includes('bucket') || error.message?.includes('not found')) {
                Alert.alert(
                  'Storage Setup Required',
                  'Please ensure the "user-photos" storage bucket exists in your Supabase project.'
                );
              }
              throw error;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('user-photos')
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

  const removePhoto = (index: number) => {
    const newPhotos = data.photos.filter((_, i) => i !== index);
    updateData('photos', newPhotos);
  };

  const toggleInterest = (interest: string) => {
    const newInterests = data.interests.includes(interest)
      ? data.interests.filter(i => i !== interest)
      : [...data.interests, interest];
    updateData('interests', newInterests);
  };

  const toggleGoal = (goal: string) => {
    const newGoals = data.relationshipGoals.includes(goal)
      ? data.relationshipGoals.filter(g => g !== goal)
      : [...data.relationshipGoals, goal];
    updateData('relationshipGoals', newGoals);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      console.log('Creating profile for user:', user.id);
      console.log('Photos already uploaded:', data.photos);

      // All photos should already be uploaded to Supabase by this point
      // Verify that all photos are Supabase URLs
      const validPhotos = data.photos.filter(photo => 
        photo.includes('supabase') || photo.startsWith('http')
      );

      if (validPhotos.length < 2) {
        Alert.alert(
          'Photos Required',
          'Please upload at least 2 photos to complete your profile.'
        );
        setLoading(false);
        return;
      }

      // Create/update profile with Supabase photo URLs
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name: data.name,
          bio: data.bio,
          age: parseInt(data.age),
          gender: data.gender,
          location: data.location,
          looking_for: data.lookingFor,
          interests: data.interests,
          relationship_goals: data.relationshipGoals.join(','),
          photos: validPhotos,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Profile creation error:', error);
        throw error;
      }

      console.log('Profile created successfully with uploaded photos');

      // Show success message and let App.tsx handle the navigation
      Alert.alert('Welcome!', 'Your profile has been created successfully!', [
        {
          text: 'Get Started',
          onPress: () => {
            setLoading(false);
            // The App.tsx will automatically detect the completed onboarding through
            // the real-time subscription and navigate to the main app
            console.log('Onboarding completed, App.tsx should detect the change');
          }
        }
      ]);
    } catch (error) {
      console.error('Error creating profile:', error);
      Alert.alert('Error', 'Failed to create profile. Please try again.');
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Add Photos</Text>
            <Text style={styles.stepSubtitle}>Add at least 2 photos (minimum required)</Text>
            
            <View style={styles.photosGrid}>
              {data.photos.map((photo, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri: photo }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.removePhoto}
                    onPress={() => removePhoto(index)}
                  >
                    <Ionicons name="close" size={20} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
              {data.photos.length < 6 && (
                <TouchableOpacity style={styles.addPhoto} onPress={pickImage}>
                  <Ionicons name="camera" size={40} color={theme.colors.primary} />
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Your Interests</Text>
            <Text style={styles.stepSubtitle}>Select at least 5 interests</Text>
            
            <View style={styles.interestsGrid}>
              {INTERESTS_OPTIONS.map((interest) => (
                <TouchableOpacity
                  key={interest}
                  style={[
                    styles.interestChip,
                    data.interests.includes(interest) && styles.interestChipSelected
                  ]}
                  onPress={() => toggleInterest(interest)}
                >
                  <Text style={[
                    styles.interestText,
                    data.interests.includes(interest) && styles.interestTextSelected
                  ]}>
                    {interest}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>What's your name?</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              value={data.name}
              onChangeText={(text) => updateData('name', text)}
              maxLength={50}
            />
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>About yourself</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              placeholder="Tell us about yourself..."
              value={data.bio}
              onChangeText={(text) => updateData('bio', text)}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Where do you live?</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your city"
              value={data.location}
              onChangeText={(text) => updateData('location', text)}
              maxLength={100}
            />
          </View>
        );

      case 5:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>How old are you?</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your age"
              value={data.age}
              onChangeText={(text) => updateData('age', text)}
              keyboardType="numeric"
              maxLength={2}
            />
          </View>
        );

      case 6:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Gender</Text>
            <View style={styles.optionsContainer}>
              {[
                { display: 'Man', value: 'male' },
                { display: 'Woman', value: 'female' },
                { display: 'Non-binary', value: 'non-binary' },
                { display: 'Other', value: 'other' }
              ].map((gender) => (
                <TouchableOpacity
                  key={gender.value}
                  style={[
                    styles.optionButton,
                    data.gender === gender.value && styles.optionButtonSelected
                  ]}
                  onPress={() => updateData('gender', gender.value)}
                >
                  <Text style={[
                    styles.optionText,
                    data.gender === gender.value && styles.optionTextSelected
                  ]}>
                    {gender.display}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 7:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>What are you looking for?</Text>
            <View style={styles.optionsContainer}>
              {[
                { display: 'Men', value: 'men' },
                { display: 'Women', value: 'women' },
                { display: 'Everyone', value: 'everyone' }
              ].map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    data.lookingFor === option.value && styles.optionButtonSelected
                  ]}
                  onPress={() => updateData('lookingFor', option.value)}
                >
                  <Text style={[
                    styles.optionText,
                    data.lookingFor === option.value && styles.optionTextSelected
                  ]}>
                    {option.display}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${((currentStep + 1) / totalSteps) * 100}%` }]} />
        </View>
        <Text style={styles.stepCounter}>{currentStep + 1} of {totalSteps}</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderStep()}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.backButton]}
          onPress={prevStep}
          disabled={currentStep === 0}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.nextButton, (!canProceed() || loading) && styles.buttonDisabled]}
          onPress={nextStep}
          disabled={!canProceed() || loading}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="white" size="small" />
              <Text style={styles.loadingText}>
                {currentStep === 0 ? 'Uploading...' : 
                 currentStep === totalSteps - 1 ? 'Creating Profile...' : 'Loading...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.nextButtonText}>
              {currentStep === totalSteps - 1 ? 'Complete' : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  progressContainer: {
    height: 4,
    backgroundColor: theme.colors.gray[200],
    borderRadius: 2,
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  stepCounter: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContainer: {
    flex: 1,
    paddingVertical: 40,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  photoContainer: {
    width: '48%',
    aspectRatio: 1,
    marginBottom: 12,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removePhoto: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  addPhoto: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: theme.colors.gray[100],
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.gray[300],
    borderStyle: 'dashed',
  },
  addPhotoText: {
    color: theme.colors.primary,
    fontSize: 14,
    marginTop: 8,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  interestChip: {
    backgroundColor: theme.colors.gray[100],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: theme.colors.gray[300],
  },
  interestChipSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  interestText: {
    color: theme.colors.text,
    fontSize: 14,
  },
  interestTextSelected: {
    color: 'white',
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
  },
  bioInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingVertical: 16,
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
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  backButton: {
    backgroundColor: theme.colors.gray[200],
  },
  backButtonText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: theme.colors.primary,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});