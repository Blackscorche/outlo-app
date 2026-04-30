import React, { useState, useEffect } from "react";
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
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { showImagePickerOptions } from "../utils/imagePicker";
import { commonStyles } from "../styles/common";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../integrations/supabase/client";
import { validateSafeText } from "../utils/contentModeration";
import { useTheme } from '../contexts/ThemeContext';

GoogleSignin.configure({
  webClientId:
    "447020157078-j7dgtcldvhhom3tbbshbm4hhg0k9pg9j.apps.googleusercontent.com",
  iosClientId:
    "447020157078-5erck39597ss1lohdc4vjc809di4g3bc.apps.googleusercontent.com",
});

const INTERESTS_OPTIONS = [
  { label: "Travel", icon: "airplane" as const },
  { label: "Photography", icon: "camera" as const },
  { label: "Music", icon: "musical-notes" as const },
  { label: "Sports", icon: "football" as const },
  { label: "Art", icon: "color-palette" as const },
  { label: "Reading", icon: "book" as const },
  { label: "Movies", icon: "film" as const },
  { label: "Dancing", icon: "body" as const },
  { label: "Cooking", icon: "restaurant" as const },
  { label: "Gaming", icon: "game-controller" as const },
  { label: "Hiking", icon: "walk" as const },
  { label: "Fitness", icon: "barbell" as const },
  { label: "Fashion", icon: "shirt" as const },
  { label: "Food", icon: "fast-food" as const },
  { label: "Animals", icon: "paw" as const },
  { label: "Technology", icon: "laptop" as const },
  { label: "Nature", icon: "leaf" as const },
  { label: "Coffee", icon: "cafe" as const },
  { label: "Wine", icon: "wine" as const },
  { label: "Yoga", icon: "accessibility" as const },
  { label: "Running", icon: "speedometer" as const },
  { label: "Swimming", icon: "water" as const },
  { label: "Cycling", icon: "bicycle" as const },
  { label: "Meditation", icon: "rose" as const },
];

const TERMS_URL =
  "https://youthful-bath-564.notion.site/Outlo-Terms-of-Service-32f2528e6c418020b72de5f727b05da2";
const PRIVACY_POLICY_URL =
  "https://youthful-bath-564.notion.site/Outlo-Privacy-Policy-32f2528e6c4180028ae7d72d7cc9a2b7";
const COMMUNITY_GUIDELINES_URL =
  "https://youthful-bath-564.notion.site/Outlo-Community-Guidelines-1f12528e6c41806ab694d4ec2bc722be";

const AuthScreen = ({ navigation }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState(1);
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [signupStep, setSignupStep] = useState(1); // 1: Basic Info, 2: Profile Details, 3: Photos & Interests
  const [acceptedTerms, setAcceptedTerms] = useState(false);

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
    fullName: "",
    age: "",
    gender: "",
    bio: "",
    location: "",
    lookingFor: "",
    interests: [],
    avatar: null,
    photos: [],
  });

  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem("rememberedEmail");
        const savedPassword = await AsyncStorage.getItem("rememberedPassword");
        if (savedEmail && savedPassword) {
          setEmail(savedEmail);
          setPassword(savedPassword);
          setRememberMe(true);
        }
      } catch (e) {
        // ignore
      }
    };
    loadSavedCredentials();
  }, []);

  const updateProfileData = (key, value) => {
    setProfileData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleInterest = (interest) => {
    const newInterests = profileData.interests.includes(interest)
      ? profileData.interests.filter((i) => i !== interest)
      : [...profileData.interests, interest];
    updateProfileData("interests", newInterests);
  };

  const pickAvatar = async () => {
    showImagePickerOptions(
      {
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      },
      (imageUri) => {
        console.log("Avatar selected:", imageUri);
        // Store local URI for now, will upload during account creation
        updateProfileData("avatar", imageUri);
      },
    );
  };

  const pickImage = async () => {
    if (profileData.photos.length >= 4) {
      Alert.alert("Limit reached", "You can upload maximum 4 post images");
      return;
    }

    showImagePickerOptions(
      {
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      },
      (imageUri) => {
        console.log("Post image selected:", imageUri);
        // Store local URI for now, will upload during account creation
        updateProfileData("photos", [...profileData.photos, imageUri]);
      },
    );
  };

  const removePhoto = (index) => {
    const newPhotos = profileData.photos.filter((_, i) => i !== index);
    updateProfileData("photos", newPhotos);
  };

  const validateSignUpData = () => {
    const bioCheck = validateSafeText(profileData.bio, "bio");
    if (!bioCheck.valid) {
      Alert.alert("Not Allowed", bioCheck.message);
      return false;
    }

    if (!profileData.fullName.trim()) {
      Alert.alert("Error", "Please enter your full name");
      return false;
    }
    if (!profileData.age.trim() || parseInt(profileData.age) < 18) {
      Alert.alert("Error", "Please enter a valid age (18+)");
      return false;
    }
    if (!profileData.gender) {
      Alert.alert("Error", "Please select your gender");
      return false;
    }
    if (!profileData.bio.trim()) {
      Alert.alert("Error", "Please write a short bio");
      return false;
    }
    if (!profileData.location.trim()) {
      Alert.alert("Error", "Please enter your location");
      return false;
    }
    if (!profileData.lookingFor) {
      Alert.alert("Error", "Please specify who you prefer to connect with");
      return false;
    }
    if (profileData.interests.length < 3) {
      Alert.alert("Error", "Please select at least 3 interests");
      return false;
    }
    if (!profileData.avatar) {
      Alert.alert("Error", "Please add a profile avatar");
      return false;
    }
    if (profileData.photos.length < 2) {
      Alert.alert("Error", "Please add at least 2 post images");
      return false;
    }
    return true;
  };

  const uploadImageToStorage = async (
    imageUri,
    userId,
    bucket = "user-photos",
  ) => {
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
            const base64Data = base64String.split(",")[1];

            console.log("Converted to base64, uploading to Supabase...");

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
                contentType: "image/jpeg",
                cacheControl: "3600",
                upsert: true, // Allow overwriting if needed
              });

            if (error) {
              console.error("Supabase upload error:", error);

              if (error.message?.includes("row-level security policy")) {
                Alert.alert(
                  "Storage Permission Error",
                  `Please run the following SQL in your Supabase dashboard:\n\n` +
                  "1. Go to SQL Editor\n" +
                  "2. Create bucket if not exists:\n" +
                  `INSERT INTO storage.buckets (id, name, public) VALUES ('${bucket}', '${bucket}', true) ON CONFLICT DO NOTHING;\n\n` +
                  "3. Set RLS policies:\n" +
                  `CREATE POLICY "Anyone can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = '${bucket}');\n` +
                  `CREATE POLICY "Anyone can view" ON storage.objects FOR SELECT USING (bucket_id = '${bucket}');\n` +
                  `CREATE POLICY "Users can update own" ON storage.objects FOR UPDATE USING (bucket_id = '${bucket}' AND auth.uid()::text = owner);\n` +
                  `CREATE POLICY "Users can delete own" ON storage.objects FOR DELETE USING (bucket_id = '${bucket}' AND auth.uid()::text = owner);`,
                );
              } else if (
                error.message?.includes("bucket") ||
                error.message?.includes("not found")
              ) {
                Alert.alert(
                  "Storage Setup Required",
                  `Please ensure the "${bucket}" storage bucket exists in your Supabase project.`,
                );
              }
              throw error;
            }

            // Get public URL
            const {
              data: { publicUrl },
            } = supabase.storage.from(bucket).getPublicUrl(filePath);

            console.log("Upload successful! URL:", publicUrl);
            resolve(publicUrl);
          } catch (error) {
            console.error("Error in base64 upload:", error);
            reject(error);
          }
        };

        reader.onerror = (error) => {
          console.error("FileReader error:", error);
          reject(error);
        };

        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      Alert.alert(
        "Upload Failed",
        "Failed to upload image. Please check your internet connection and try again.",
      );
      return null;
    }
  };

  const openExternalLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      // console.error("Failed to open URL:", url, error)
      Alert.alert("Error", "Unable to open link");
    }
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
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

        if (rememberMe) {
          await AsyncStorage.setItem("rememberedEmail", email);
          await AsyncStorage.setItem("rememberedPassword", password);
        } else {
          await AsyncStorage.removeItem("rememberedEmail");
          await AsyncStorage.removeItem("rememberedPassword");
        }
      } else {
        if (!acceptedTerms) {
          Alert.alert(
            "Terms Required",
            "You must agree to the Terms of Use and Community Guidelines before creating an account.",
          );
          return;
        }

        if (!validateSignUpData()) {
          return;
        }

        const { data: authData, error: signUpError } =
          await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: undefined,
              data: {
                full_name: profileData.fullName,
              },
            },
          });

        if (signUpError) throw signUpError;

        if (authData.user) {
          console.log("Uploading avatar to Supabase...");
          const uploadedAvatar = await uploadImageToStorage(
            profileData.avatar,
            authData.user.id,
            "user-photos",
          );

          if (!uploadedAvatar) {
            Alert.alert(
              "Upload Failed",
              "Failed to upload avatar. Please check your internet connection and try again.",
            );
            return;
          }

          console.log("Uploading post images to Supabase...");
          const uploadedPhotos: string[] = [];

          for (const photo of profileData.photos) {
            const uploadedUrl = await uploadImageToStorage(
              photo,
              authData.user.id,
              "posts-media",
            );
            if (uploadedUrl) {
              uploadedPhotos.push(uploadedUrl as string);
            }
          }

          if (uploadedPhotos.length < 2) {
            Alert.alert(
              "Upload Failed",
              "Failed to upload post images. Please check your internet connection and try again.",
            );
            return;
          }

          const { error: profileError } = await supabase
            .from("profiles")
            .upsert({
              id: authData.user.id,
              name: profileData.fullName,
              bio: profileData.bio,
              age: parseInt(profileData.age, 10),
              gender: profileData.gender,
              location: profileData.location,
              looking_for: profileData.lookingFor,
              interests: profileData.interests,
              photos: [uploadedAvatar],
              is_online: true,
              is_visible: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (profileError) throw profileError;

          console.log("Profile created successfully with avatar");

          for (let i = 0; i < uploadedPhotos.length; i++) {
            const { error: postError } = await supabase.from("posts").insert({
              user_id: authData.user.id,
              media_url: uploadedPhotos[i],
              media_type: "photo",
              caption: i === 0 ? "My first post!" : "",
              is_deleted: false,
              created_at: new Date().toISOString(),
            });

            if (postError) {
              console.error("Error creating post:", postError);
            }
          }

          console.log("Posts created successfully");
          setVerifyEmail(email);
          setShowVerifyModal(true);
        }
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      const response = await GoogleSignin.signIn();
      const idToken = response?.data?.idToken;
      if (!idToken) throw new Error("No ID token from Google");

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });
      if (error) throw error;
    } catch (error: any) {
      if (error.code !== "SIGN_IN_CANCELLED") {
        Alert.alert("Google Sign In Failed", error.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    try {
      setAppleLoading(true);

      const rawNonce =
        Math.random().toString(36).substring(2, 10) +
        Math.random().toString(36).substring(2, 10);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      const identityToken = credential.identityToken;
      if (!identityToken) throw new Error("No identity token from Apple");

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: identityToken,
        nonce: rawNonce,
      });
      if (error) throw error;
    } catch (error: any) {
      if (error.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Apple Sign In Failed", error.message);
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!forgotPasswordEmail.trim()) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }
    setForgotPasswordLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(
      forgotPasswordEmail.trim(),
    );
    setForgotPasswordLoading(false);
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    setForgotPasswordStep(2);
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      Alert.alert("Error", "Please enter the verification code");
      return;
    }
    setForgotPasswordLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: forgotPasswordEmail.trim(),
      token: otpCode.trim(),
      type: "recovery",
    });
    setForgotPasswordLoading(false);
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    setForgotPasswordStep(3);
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    setForgotPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setForgotPasswordLoading(false);
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    await supabase.auth.signOut();
    setForgotPasswordStep(4);
  };
  const { theme } = useTheme();
  const styles = makeStyles(theme);

  return (
    <>
      <View style={styles.container}>
        <SafeAreaView style={styles.container}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
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
                  source={require("../../assets/logos/darkmode_logo.png")}
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
                        <Ionicons
                          name="mail-outline"
                          size={20}
                          color="#999"
                          style={styles.inputIcon}
                        />
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
                        <Ionicons
                          name="lock-closed-outline"
                          size={20}
                          color="#999"
                          style={styles.inputIcon}
                        />
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
                            name={
                              showPassword ? "eye-outline" : "eye-off-outline"
                            }
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
                          <View
                            style={[
                              styles.checkbox,
                              rememberMe && styles.checkboxChecked,
                            ]}
                          >
                            {rememberMe && (
                              <Ionicons
                                name="checkmark"
                                size={14}
                                color="white"
                              />
                            )}
                          </View>
                          <Text style={styles.rememberText}>Remember me</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            setForgotPasswordEmail(email);
                            setForgotPasswordStep(1);
                            setOtpCode("");
                            setNewPassword("");
                            setShowForgotPassword(true);
                          }}
                        >
                          <Text style={styles.forgotText}>
                            Forgot password?
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.signInButton,
                          loading && styles.buttonDisabled,
                        ]}
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
                        {Platform.OS === "android" && (
                          <TouchableOpacity
                            style={styles.socialButton}
                            onPress={handleGoogleLogin}
                            disabled={googleLoading}
                          >
                            {googleLoading ? (
                              <ActivityIndicator size="small" color="#DB4437" />
                            ) : (
                              <Ionicons
                                name="logo-google"
                                size={20}
                                color="#DB4437"
                              />
                            )}
                            <Text style={styles.socialButtonText}>Google</Text>
                          </TouchableOpacity>
                        )}
                        {Platform.OS === "ios" && (
                          <TouchableOpacity
                            style={styles.socialButton}
                            onPress={handleAppleLogin}
                            disabled={appleLoading}
                          >
                            {appleLoading ? (
                              <ActivityIndicator size="small" color="#000000" />
                            ) : (
                              <Ionicons
                                name="logo-apple"
                                size={20}
                                color="#000000"
                              />
                            )}
                            <Text style={styles.socialButtonText}>Apple</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* <View style={styles.termsContainer}>
                        <TouchableOpacity
                          style={styles.termsCheckboxRow}
                          onPress={() => setAcceptedTerms(!acceptedTerms)}
                          activeOpacity={0.8}
                        >
                          <View
                            style={[
                              styles.checkbox,
                              acceptedTerms && styles.checkboxChecked,
                            ]}
                          >
                            {acceptedTerms && (
                              <Ionicons
                                name="checkmark"
                                size={14}
                                color="white"
                              />
                            )}
                          </View>

                          <Text style={styles.termsText}>
                            I agree to the{" "}
                            <Text
                              style={styles.termsLink}
                              onPress={() =>
                                Linking.openURL("https://www.outlo.app/terms")
                              }
                            >
                              Terms of Use
                            </Text>{" "}
                            and{" "}
                            <Text
                              style={styles.termsLink}
                              onPress={() =>
                                Linking.openURL(
                                  "https://www.outlo.app/community-guidelines",
                                )
                              }
                            >
                              Community Guidelines
                            </Text>
                          </Text>
                        </TouchableOpacity>
                      </View> */}

                      <View style={styles.signUpPrompt}>
                        <Text style={styles.signUpText}>
                          Don't have an account?{" "}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            setIsLogin(false);
                            setAcceptedTerms(false);
                          }}
                        >
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
                      <TouchableOpacity
                        style={styles.modernAvatarButton}
                        onPress={pickAvatar}
                      >
                        {profileData.avatar ? (
                          <>
                            <Image
                              source={{ uri: profileData.avatar }}
                              style={styles.modernAvatar}
                            />
                            <TouchableOpacity
                              style={styles.modernRemoveAvatar}
                              onPress={() => updateProfileData("avatar", null)}
                            >
                              <Ionicons
                                name="close-circle"
                                size={28}
                                color="#4CAF50"
                              />
                            </TouchableOpacity>
                          </>
                        ) : (
                          <View style={styles.modernAvatarPlaceholder}>
                            <Ionicons name="camera" size={32} color="#4CAF50" />
                            <Text style={styles.modernAvatarText}>
                              Add Photo
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>

                    {/* Account Info */}
                    <View style={styles.modernInputGroup}>
                      <View style={styles.modernInputWrapper}>
                        <Ionicons
                          name="person-outline"
                          size={20}
                          color="#999"
                          style={styles.inputIcon}
                        />
                        <TextInput
                          style={styles.modernInput}
                          placeholder="Full Name"
                          placeholderTextColor="#999"
                          value={profileData.fullName}
                          onChangeText={(text) =>
                            updateProfileData("fullName", text)
                          }
                          autoCapitalize="words"
                        />
                      </View>

                      <View style={styles.modernInputWrapper}>
                        <Ionicons
                          name="mail-outline"
                          size={20}
                          color="#999"
                          style={styles.inputIcon}
                        />
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
                        <Ionicons
                          name="lock-closed-outline"
                          size={20}
                          color="#999"
                          style={styles.inputIcon}
                        />
                        <TextInput
                          style={styles.modernInput}
                          placeholder="Password"
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
                            name={
                              showPassword ? "eye-outline" : "eye-off-outline"
                            }
                            size={20}
                            color="#999"
                          />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.modernInputWrapper}>
                        <Ionicons
                          name="calendar-outline"
                          size={20}
                          color="#999"
                          style={styles.inputIcon}
                        />
                        <TextInput
                          style={styles.modernInput}
                          placeholder="Age"
                          placeholderTextColor="#999"
                          value={profileData.age}
                          onChangeText={(text) =>
                            updateProfileData("age", text)
                          }
                          keyboardType="numeric"
                          maxLength={2}
                        />
                      </View>

                      <View style={styles.modernInputWrapper}>
                        <Ionicons
                          name="location-outline"
                          size={20}
                          color="#999"
                          style={styles.inputIcon}
                        />
                        <TextInput
                          style={styles.modernInput}
                          placeholder="City"
                          placeholderTextColor="#999"
                          value={profileData.location}
                          onChangeText={(text) =>
                            updateProfileData("location", text)
                          }
                        />
                      </View>
                    </View>

                    {/* Gender Selection */}
                    <View style={styles.modernSection}>
                      <Text style={styles.modernLabel}>I am</Text>
                      <View style={styles.modernOptionsRow}>
                        {[
                          { display: "Man", value: "male", icon: "male" },
                          { display: "Woman", value: "female", icon: "female" },
                          {
                            display: "Other",
                            value: "other",
                            icon: "male-female",
                          },
                        ].map((gender) => (
                          <TouchableOpacity
                            key={gender.value}
                            style={[
                              styles.modernOptionCard,
                              profileData.gender === gender.value &&
                              styles.modernOptionCardSelected,
                            ]}
                            onPress={() =>
                              updateProfileData("gender", gender.value)
                            }
                          >
                            <Ionicons
                              name={gender.icon}
                              size={24}
                              color={
                                profileData.gender === gender.value
                                  ? "#FFF"
                                  : "#4CAF50"
                              }
                            />
                            <Text
                              style={[
                                styles.modernOptionText,
                                profileData.gender === gender.value &&
                                styles.modernOptionTextSelected,
                              ]}
                            >
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
                          { display: "Men", value: "men" },
                          { display: "Women", value: "women" },
                          { display: "Everyone", value: "everyone" },
                        ].map((option) => (
                          <TouchableOpacity
                            key={option.value}
                            style={[
                              styles.modernOptionCard,
                              profileData.lookingFor === option.value &&
                              styles.modernOptionCardSelected,
                            ]}
                            onPress={() =>
                              updateProfileData("lookingFor", option.value)
                            }
                          >
                            <Text
                              style={[
                                styles.modernOptionText,
                                profileData.lookingFor === option.value &&
                                styles.modernOptionTextSelected,
                              ]}
                            >
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
                        onChangeText={(text) => updateProfileData("bio", text)}
                        multiline
                        numberOfLines={4}
                        maxLength={500}
                        textAlignVertical="top"
                      />
                      <Text style={styles.charCount}>
                        {profileData.bio.length}/500
                      </Text>
                    </View>

                    {/* Photos */}
                    <View style={styles.modernSection}>
                      <Text style={styles.modernLabel}>
                        Add Photos (Min. 2)
                      </Text>
                      <View style={styles.modernPhotosGrid}>
                        {profileData.photos.map((photo, index) => (
                          <View key={index} style={styles.modernPhotoItem}>
                            <Image
                              source={{ uri: photo }}
                              style={styles.modernPhoto}
                            />
                            <TouchableOpacity
                              style={styles.modernRemovePhoto}
                              onPress={() => removePhoto(index)}
                            >
                              <Ionicons
                                name="close-circle"
                                size={24}
                                color="#4CAF50"
                              />
                            </TouchableOpacity>
                          </View>
                        ))}
                        {profileData.photos.length < 4 && (
                          <TouchableOpacity
                            style={styles.modernAddPhoto}
                            onPress={pickImage}
                          >
                            <Ionicons
                              name="add-circle"
                              size={48}
                              color="#4CAF50"
                            />
                            <Text style={styles.modernAddPhotoText}>Add</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Interests */}
                    <View style={styles.modernSection}>
                      <Text style={styles.modernLabel}>
                        My Interests (Select at least 3)
                      </Text>
                      <View style={styles.modernInterestsGrid}>
                        {INTERESTS_OPTIONS.map((interest) => (
                          <TouchableOpacity
                            key={interest.label}
                            style={[
                              styles.modernInterestChip,
                              profileData.interests.includes(interest.label) &&
                              styles.modernInterestChipSelected,
                            ]}
                            onPress={() => toggleInterest(interest.label)}
                          >
                            <Ionicons
                              name={interest.icon}
                              size={16}
                              color={
                                profileData.interests.includes(interest.label)
                                  ? "#FFF"
                                  : "#4CAF50"
                              }
                              style={{ marginRight: 6 }}
                            />
                            <Text
                              style={[
                                styles.modernInterestText,
                                profileData.interests.includes(
                                  interest.label,
                                ) && styles.modernInterestTextSelected,
                              ]}
                            >
                              {interest.label}
                            </Text>
                            {profileData.interests.includes(interest.label) && (
                              <Ionicons
                                name="checkmark-circle"
                                size={16}
                                color="#FFF"
                                style={{ marginLeft: 6 }}
                              />
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View style={styles.termsContainer}>
                      <TouchableOpacity
                        style={styles.termsCheckboxRow}
                        onPress={() => setAcceptedTerms(!acceptedTerms)}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            acceptedTerms && styles.checkboxChecked,
                          ]}
                        >
                          {acceptedTerms && (
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color="white"
                            />
                          )}
                        </View>

                        <Text style={styles.termsText}>
                          I agree to the{" "}
                          <Text
                            style={styles.termsLink}
                            onPress={() => openExternalLink(TERMS_URL)}
                          >
                            Terms of Use
                          </Text>
                          ,{" "}
                          <Text
                            style={styles.termsLink}
                            onPress={() => openExternalLink(PRIVACY_POLICY_URL)}
                          >
                            Privacy Policy
                          </Text>{" "}
                          and{" "}
                          <Text
                            style={styles.termsLink}
                            onPress={() =>
                              openExternalLink(COMMUNITY_GUIDELINES_URL)
                            }
                          >
                            Community Guidelines
                          </Text>
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Sign Up Button */}
                    <TouchableOpacity
                      style={[
                        styles.modernSignupButton,
                        (loading || !acceptedTerms) && styles.buttonDisabled,
                      ]}
                      onPress={handleAuth}
                      disabled={loading || !acceptedTerms}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <>
                          <Text style={styles.modernSignupButtonText}>
                            Create Account
                          </Text>
                          <Ionicons
                            name="arrow-forward"
                            size={20}
                            color="white"
                          />
                        </>
                      )}
                    </TouchableOpacity>

                    {/* Sign In Link */}
                    <View style={styles.signUpPrompt}>
                      <Text style={styles.signUpText}>
                        Already have an account?{" "}
                      </Text>
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
      </View>

      {/* ── EMAIL VERIFICATION MODAL ── */}
      <Modal visible={showVerifyModal} transparent animationType="fade">
        <View style={styles.verifyOverlay}>
          <View style={styles.verifyCard}>
            <View style={styles.verifyIconCircle}>
              <Ionicons
                name="mail-outline"
                size={36}
                color={theme.colors.primary}
              />
            </View>
            <Text style={styles.verifyTitle}>Verify your email</Text>
            <Text style={styles.verifyBody}>
              We sent a verification link to{"\n"}
              <Text style={styles.verifyEmailText}>{verifyEmail}</Text>
            </Text>
            <Text style={styles.verifyHint}>
              Please check your inbox and click the link to activate your
              account.
            </Text>
            <TouchableOpacity
              style={styles.verifyBtn}
              onPress={() => setShowVerifyModal(false)}
            >
              <Text style={styles.verifyBtnText}>Got it</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                await supabase.auth.resend({
                  type: "signup",
                  email: verifyEmail,
                });
                Alert.alert("Sent", "Verification email resent.");
              }}
            >
              <Text style={styles.verifyResend}>Resend email</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── FORGOT PASSWORD MODAL ── */}
      <Modal visible={showForgotPassword} transparent animationType="fade">
        <View style={styles.verifyOverlay}>
          <View style={styles.verifyCard}>
            {forgotPasswordStep === 1 && (
              <>
                <View style={styles.verifyIconCircle}>
                  <Ionicons
                    name="key-outline"
                    size={36}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={styles.verifyTitle}>Reset Password</Text>
                <Text style={styles.verifyBody}>
                  Enter your email address and we'll send you a verification
                  code.
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { marginTop: 16, marginBottom: 16 },
                  ]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color="#999"
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Email address"
                    placeholderTextColor="#999"
                    value={forgotPasswordEmail}
                    onChangeText={setForgotPasswordEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.verifyBtn,
                    forgotPasswordLoading && { opacity: 0.7 },
                  ]}
                  onPress={handleSendOtp}
                  disabled={forgotPasswordLoading}
                >
                  {forgotPasswordLoading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.verifyBtnText}>Send Code</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowForgotPassword(false)}>
                  <Text style={styles.verifyResend}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}

            {forgotPasswordStep === 2 && (
              <>
                <View style={styles.verifyIconCircle}>
                  <Ionicons
                    name="mail-outline"
                    size={36}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={styles.verifyTitle}>Enter Code</Text>
                <Text style={styles.verifyBody}>
                  We sent a 6-digit code to{"\n"}
                  <Text style={styles.verifyEmailText}>
                    {forgotPasswordEmail}
                  </Text>
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { marginTop: 16, marginBottom: 16 },
                  ]}
                >
                  <Ionicons
                    name="keypad-outline"
                    size={18}
                    color="#999"
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    style={styles.inputField}
                    placeholder="6-digit code"
                    placeholderTextColor="#999"
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.verifyBtn,
                    forgotPasswordLoading && { opacity: 0.7 },
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={forgotPasswordLoading}
                >
                  {forgotPasswordLoading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.verifyBtnText}>Verify Code</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSendOtp}>
                  <Text style={styles.verifyResend}>Resend code</Text>
                </TouchableOpacity>
              </>
            )}

            {forgotPasswordStep === 3 && (
              <>
                <View style={styles.verifyIconCircle}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={36}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={styles.verifyTitle}>New Password</Text>
                <Text style={styles.verifyBody}>
                  Enter your new password (at least 6 characters).
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    { marginTop: 16, marginBottom: 16 },
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={18}
                    color="#999"
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    style={styles.inputField}
                    placeholder="New password"
                    placeholderTextColor="#999"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.verifyBtn,
                    forgotPasswordLoading && { opacity: 0.7 },
                  ]}
                  onPress={handleResetPassword}
                  disabled={forgotPasswordLoading}
                >
                  {forgotPasswordLoading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={styles.verifyBtnText}>Reset Password</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {forgotPasswordStep === 4 && (
              <>
                <View style={styles.verifyIconCircle}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={36}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={styles.verifyTitle}>Password Reset!</Text>
                <Text style={styles.verifyBody}>
                  Your password has been successfully updated. You can now sign
                  in with your new password.
                </Text>
                <TouchableOpacity
                  style={styles.verifyBtn}
                  onPress={() => setShowForgotPassword(false)}
                >
                  <Text style={styles.verifyBtnText}>Done</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const makeStyles = (t: any) => StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: t.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: t.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 100,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 0,
    marginBottom: 10,
    position: "relative",
    height: 180,
    justifyContent: "center",
  },
  decorativeElements: {
    position: "absolute",
    width: "130%",
    height: "100%",
    left: "-15%",
  },
  decorIcon: {
    position: "absolute",
    opacity: 0.7,
  },
  logo: {
    width: 240,
    height: 80,
    zIndex: 10,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: "700",
    color: t.colors.text,
    textAlign: "center",
    marginBottom: 28,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  loginSection: {
    backgroundColor: t.colors.surface,
    borderRadius: 24,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    marginHorizontal: 4,
  },
  inputLabel: {
    fontSize: 14,
    color: "#333",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  inputIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 16,
    color: t.colors.text,
    paddingVertical: 16,
  },
  eyeIcon: {
    padding: 4,
  },
  rememberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  rememberContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#DDD",
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  rememberText: {
    fontSize: 14,
    color: t.colors.textSecondary,
  },
  forgotText: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "500",
  },
  signInButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 25,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  signInButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  orText: {
    textAlign: "center",
    color: t.colors.textSecondary,
    fontSize: 14,
    marginBottom: 16,
  },
  socialButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  socialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  socialButtonText: {
    fontSize: 14,
    color: t.colors.text,
    fontWeight: "500",
  },
  signUpPrompt: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signUpText: {
    fontSize: 14,
    color: t.colors.textSecondary,
  },
  signUpLink: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "600",
  },
  header: {
    alignItems: "center",
    marginBottom: t.spacing.xl,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingVertical: t.spacing.lg,
    paddingHorizontal: t.spacing.xl,
    borderRadius: t.borderRadius.xl,
  },
  title: {
    fontSize: t.fontSize.xxxl,
    fontWeight: "bold",
    color: t.colors.primary,
    marginBottom: t.spacing.sm,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: t.fontSize.lg,
    color: t.colors.text,
    textAlign: "center",
    fontWeight: "500",
  },
  form: {
    width: "100%",
  },
  section: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: t.borderRadius.lg,
    padding: t.spacing.lg,
    marginBottom: t.spacing.lg,
  },
  sectionTitle: {
    fontSize: t.fontSize.lg,
    fontWeight: "600",
    color: t.colors.text,
    marginBottom: t.spacing.md,
  },
  inputContainer: {
    marginBottom: t.spacing.md,
  },
  label: {
    fontSize: t.fontSize.sm,
    fontWeight: "600",
    color: t.colors.text,
    marginBottom: t.spacing.xs,
  },
  input: {
    backgroundColor: t.colors.background,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.md,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    fontSize: t.fontSize.base,
    color: t.colors.text,
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.spacing.sm,
  },
  optionChip: {
    backgroundColor: t.colors.background,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.md,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
  },
  optionChipSelected: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  optionText: {
    fontSize: t.fontSize.sm,
    color: t.colors.text,
  },
  optionTextSelected: {
    color: "white",
  },
  photosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.spacing.sm,
  },
  photoContainer: {
    width: 80,
    height: 80,
    position: "relative",
  },
  photo: {
    width: "100%",
    height: "100%",
    borderRadius: t.borderRadius.md,
  },
  removePhoto: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    padding: 2,
  },
  addPhoto: {
    width: 80,
    height: 80,
    backgroundColor: t.colors.background,
    borderRadius: t.borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: t.colors.border,
    borderStyle: "dashed",
  },
  addPhotoText: {
    color: t.colors.primary,
    fontSize: t.fontSize.xs,
    marginTop: 4,
    textAlign: "center",
  },
  avatarContainer: {
    alignItems: "center",
    marginBottom: t.spacing.md,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: t.colors.primary,
  },
  removeAvatar: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    padding: 2,
  },
  addAvatar: {
    width: 120,
    height: 120,
    backgroundColor: t.colors.background,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: t.colors.primary,
    borderStyle: "dashed",
  },
  addAvatarText: {
    color: t.colors.primary,
    fontSize: t.fontSize.xs,
    marginTop: 4,
    textAlign: "center",
  },
  interestsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: t.spacing.sm,
  },
  interestChip: {
    backgroundColor: t.colors.background,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.lg,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
  },
  interestChipSelected: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  interestText: {
    fontSize: t.fontSize.sm,
    color: t.colors.text,
  },
  interestTextSelected: {
    color: "white",
  },
  button: {
    backgroundColor: t.colors.primary,
    borderRadius: t.borderRadius.md,
    paddingVertical: t.spacing.md,
    alignItems: "center",
    marginBottom: t.spacing.lg,
  },
  buttonText: {
    color: "white",
    fontSize: t.fontSize.base,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: t.spacing.sm,
  },
  switchMode: {
    alignItems: "center",
    marginBottom: t.spacing.lg,
  },
  switchModeText: {
    color: t.colors.primary,
    fontSize: t.fontSize.base,
  },
  // Modern Signup Styles
  backButton: {
    position: "absolute",
    top: 0,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  signupContainer: {
    backgroundColor: t.colors.surface,
    borderRadius: 24,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    marginHorizontal: 4,
  },
  signupTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: t.colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  signupSubtitle: {
    fontSize: 15,
    color: t.colors.text,
    textAlign: "center",
    marginBottom: 24,
  },
  modernAvatarSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  modernAvatarButton: {
    position: "relative",
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
    backgroundColor: t.colors.inputBg,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: t.colors.border,
    borderStyle: "dashed",
  },
  modernAvatarText: {
    fontSize: 12,
    color: t.colors.text,
    marginTop: 4,
    fontWeight: "500",
  },
  modernRemoveAvatar: {
    position: "absolute",
    top: -5,
    right: -5,
  },
  modernInputGroup: {
    marginBottom: 20,
  },
  modernInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.colors.inputBg,
    borderRadius: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 50,
  },
  modernInput: {
    flex: 1,
    fontSize: 14,
    color: t.colors.text,
  },
  modernSection: {
    marginBottom: 24,
  },
  modernLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: t.colors.text,
    marginBottom: 12,
  },
  modernOptionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  modernOptionCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    gap: 6,
  },
  modernOptionCardSelected: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  modernOptionText: {
    fontSize: 14,
    color: t.colors.text,
    fontWeight: "500",
  },
  modernOptionTextSelected: {
    color: "#FFF",
  },
  modernBioInput: {
    backgroundColor: t.colors.inputBg,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: t.colors.text,
    minHeight: 100,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  charCount: {
    fontSize: 12,
    color: t.colors.textSecondary,
    textAlign: "right",
    marginTop: 4,
  },
  modernPhotosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  modernPhotoItem: {
    width: "47%",
    aspectRatio: 1,
    position: "relative",
  },
  modernPhoto: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  modernRemovePhoto: {
    position: "absolute",
    top: -8,
    right: -8,
  },
  modernAddPhoto: {
    width: "47%",
    aspectRatio: 1,
    backgroundColor: t.colors.inputBg,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#4CAF50",
    borderStyle: "dashed",
  },
  modernAddPhotoText: {
    fontSize: 13,
    color: "#4CAF50",
    fontWeight: "500",
    marginTop: 4,
  },
  modernInterestsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modernInterestChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.colors.inputBg,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.colors.border,
    gap: 4,
  },
  modernInterestChipSelected: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  modernInterestText: {
    fontSize: 13,
    color: t.colors.text,
    fontWeight: "500",
  },
  modernInterestTextSelected: {
    color: "#FFF",
  },
  modernSignupButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 25,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 20,
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    gap: 8,
  },
  modernSignupButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },

  // Email verification modal
  verifyOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  verifyCard: {
    backgroundColor: t.colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    width: "100%",
  },
  verifyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: t.colors.inputBg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  verifyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: t.colors.text,
    marginBottom: 10,
  },
  verifyBody: {
    fontSize: 15,
    color: t.colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 8,
  },
  verifyEmailText: {
    fontWeight: "600",
    color: t.colors.text,
  },
  verifyHint: {
    fontSize: 13,
    color: t.colors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 18,
  },
  verifyBtn: {
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  verifyBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  verifyResend: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "500",
  },
  termsContainer: {
    marginTop: 4,
    marginBottom: 16,
  },
  termsCheckboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: t.colors.textSecondary,
    lineHeight: 20,
  },
  termsLink: {
    color: "#4CAF50",
    fontWeight: "600",
  },
});

export default AuthScreen;
