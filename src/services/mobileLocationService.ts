
import { Geolocation, Position } from '@capacitor/geolocation';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { securityManager } from '@/utils/securityEnhancements';

export interface LocationData {
  lat: number;
  lng: number;
  accuracy: number;
  bearing?: number; // Compass direction in degrees
  isObfuscated?: boolean;
  precisionLevel?: 'high' | 'medium' | 'low';
}

export interface LocationPrivacySettings {
  enableObfuscation: boolean;
  precisionLevel: 'high' | 'medium' | 'low';
  shareExactLocation: boolean;
}

export class MobileLocationService {
  private watchId: string | null = null;
  private isBackground = false;
  private networkStatus = true;
  private currentBearing: number = 0;
  private orientationListener: ((event: DeviceOrientationEvent) => void) | null = null;
  private lastCompassUpdate: number = 0;
  private compassEnabled: boolean = true;
  private privacySettings: LocationPrivacySettings = {
    enableObfuscation: false,
    precisionLevel: 'high',
    shareExactLocation: true
  };

  async initialize(): Promise<void> {
    // Load privacy settings from storage
    this.loadPrivacySettings();

    // Check permissions
    const permissions = await Geolocation.checkPermissions();
    if (permissions.location !== 'granted') {
      const requested = await Geolocation.requestPermissions();
      if (requested.location !== 'granted') {
        throw new Error('Location permission denied');
      }
    }

    // Initialize compass if available
    this.initializeCompass();

    // Monitor app state
    App.addListener('appStateChange', ({ isActive }) => {
      this.isBackground = !isActive;
      console.log('🔍 App state changed:', isActive ? 'foreground' : 'background');
      
      if (isActive) {
        this.startCompass();
      } else {
        this.stopCompass();
      }
    });

    // Monitor network status
    Network.addListener('networkStatusChange', status => {
      this.networkStatus = status.connected;
      console.log('🔍 Network status:', status.connected ? 'online' : 'offline');
    });
  }

  private loadPrivacySettings(): void {
    try {
      const stored = localStorage.getItem('locationPrivacySettings');
      if (stored) {
        this.privacySettings = { ...this.privacySettings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.warn('Failed to load privacy settings:', error);
    }
  }

  updatePrivacySettings(settings: Partial<LocationPrivacySettings>): void {
    this.privacySettings = { ...this.privacySettings, ...settings };
    try {
      localStorage.setItem('locationPrivacySettings', JSON.stringify(this.privacySettings));
    } catch (error) {
      console.warn('Failed to save privacy settings:', error);
    }
  }

  getPrivacySettings(): LocationPrivacySettings {
    return { ...this.privacySettings };
  }

  private initializeCompass(): void {
    if (typeof DeviceOrientationEvent !== 'undefined') {
      this.startCompass();
    } else {
      console.warn('🧭 Device orientation not supported');
    }
  }

  private startCompass(): void {
    if (typeof DeviceOrientationEvent === 'undefined' || !this.compassEnabled) return;

    this.orientationListener = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        const now = Date.now();
        // Throttle compass updates to every 200ms for better performance
        if (now - this.lastCompassUpdate < 200) return;
        
        // Correct compass bearing calculation
        let bearing = event.alpha;
        
        // Normalize bearing to 0-360 range
        bearing = bearing % 360;
        if (bearing < 0) bearing += 360;
        
        // Only update if bearing changed significantly (reduce jitter)
        const diff = Math.abs(bearing - this.currentBearing);
        const minDiff = Math.min(diff, 360 - diff);
        if (minDiff > 2) { // Only update if bearing changed by more than 2 degrees
          this.currentBearing = bearing;
          this.lastCompassUpdate = now;
        }
      }
    };

    window.addEventListener('deviceorientation', this.orientationListener);
    console.log('🧭 Compass started');
  }

  private stopCompass(): void {
    if (this.orientationListener) {
      window.removeEventListener('deviceorientation', this.orientationListener);
      this.orientationListener = null;
      console.log('🧭 Compass stopped');
    }
  }

  private processLocationData(position: Position): LocationData {
    let lat = position.coords.latitude;
    let lng = position.coords.longitude;
    let isObfuscated = false;

    // Apply privacy settings
    if (this.privacySettings.enableObfuscation && !this.privacySettings.shareExactLocation) {
      const obfuscated = securityManager.obfuscateLocation(
        lat, 
        lng, 
        this.privacySettings.precisionLevel
      );
      lat = obfuscated.lat;
      lng = obfuscated.lng;
      isObfuscated = true;
    }

    return {
      lat,
      lng,
      accuracy: position.coords.accuracy,
      bearing: this.currentBearing, // Include compass bearing
      isObfuscated,
      precisionLevel: this.privacySettings.precisionLevel
    };
  }

  async getCurrentLocation(): Promise<LocationData> {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: !this.isBackground && this.privacySettings.shareExactLocation,
      timeout: 10000,
      maximumAge: 30000
    });

    return this.processLocationData(position);
  }

  async startWatching(
    onLocationUpdate: (location: LocationData) => void,
    onError: (error: string) => void
  ): Promise<void> {
    if (this.watchId) {
      this.stopWatching();
    }

    try {
      this.watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: !this.isBackground && this.privacySettings.shareExactLocation,
          timeout: this.isBackground ? 30000 : 10000,
          maximumAge: this.isBackground ? 60000 : 30000
        },
        (position, error) => {
          if (error) {
            console.error('🔒 Location watch error:', error);
            onError(error.message);
            return;
          }
          
          if (position && this.networkStatus) {
            const locationData = this.processLocationData(position);
            
            // Log privacy-aware location update
            console.log('🔍 Location update:', {
              isObfuscated: locationData.isObfuscated,
              precisionLevel: locationData.precisionLevel,
              accuracy: locationData.accuracy
            });
            
            onLocationUpdate(locationData);
          }
        }
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unknown location error');
    }
  }

  stopWatching(): void {
    if (this.watchId) {
      Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
    }
  }

  isInBackground(): boolean {
    return this.isBackground;
  }

  isOnline(): boolean {
    return this.networkStatus;
  }

  // Privacy control methods
  enableLocationSharing(enable: boolean): void {
    this.updatePrivacySettings({ shareExactLocation: enable });
  }

  setLocationPrecision(level: 'high' | 'medium' | 'low'): void {
    this.updatePrivacySettings({ precisionLevel: level });
  }

  enableObfuscation(enable: boolean): void {
    this.updatePrivacySettings({ enableObfuscation: enable });
  }

  // Compass control methods
  enableCompass(enable: boolean): void {
    this.compassEnabled = enable;
    if (enable) {
      this.startCompass();
    } else {
      this.stopCompass();
      this.currentBearing = 0;
    }
  }

  isCompassEnabled(): boolean {
    return this.compassEnabled;
  }
}

export const mobileLocationService = new MobileLocationService();
