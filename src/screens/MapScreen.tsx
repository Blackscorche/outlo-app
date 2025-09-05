import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { commonStyles } from '../styles/common';

const MapScreen = ({ navigation }) => {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to use the map feature.'
        );
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      
      setLocation({ latitude, longitude });
      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
      setLoading(false);
    } catch (error) {
      console.error('Error getting location:', error);
      setLoading(false);
    }
  };

  const handleMarkerPress = (user) => {
    navigation.navigate('UserProfile', { userId: user.id });
  };

  const centerOnUserLocation = () => {
    if (location) {
      setRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    }
  };

  if (loading) {
    return (
      <View style={commonStyles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        {users.map((user) => (
          <Marker
            key={user.id}
            coordinate={{
              latitude: user.latitude,
              longitude: user.longitude,
            }}
            onPress={() => handleMarkerPress(user)}
          >
            <View style={styles.markerContainer}>
              <View style={styles.marker}>
                <Ionicons name="person" size={20} color="#FFFFFF" />
              </View>
              <Text style={styles.markerLabel}>{user.name}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={centerOnUserLocation}
        >
          <Ionicons name="locate" size={24} color={theme.colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => navigation.navigate('ConnectionRequests')}
        >
          <Ionicons name="people" size={24} color={theme.colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => navigation.navigate('Favorites')}
        >
          <Ionicons name="heart" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
  },
  controls: {
    position: 'absolute',
    top: 50,
    right: 10,
    gap: theme.spacing.sm,
  },
  controlButton: {
    backgroundColor: theme.colors.surface,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  markerContainer: {
    alignItems: 'center',
  },
  marker: {
    backgroundColor: theme.colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  markerLabel: {
    marginTop: 4,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
});

export default MapScreen;