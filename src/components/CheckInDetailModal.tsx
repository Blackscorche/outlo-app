import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getActivityTag } from './CheckInModal';

interface CheckInDetailModalProps {
  visible: boolean;
  onClose: () => void;
  checkIn: {
    id: string;
    location_name: string;
    description?: string;
    latitude: number;
    longitude: number;
    created_at: string;
    expires_at?: string;
    activity_tag?: string;
    profiles?: {
      id: string;
      name: string;
      photos?: string[];
      age?: number;
      gender?: string;
      bio?: string;
    };
  } | null;
  onViewProfile: (userId: string) => void;
  onGetDirections?: (latitude: number, longitude: number) => void;
}

const { width } = Dimensions.get('window');

const CheckInDetailModal: React.FC<CheckInDetailModalProps> = ({
  visible,
  onClose,
  checkIn,
  onViewProfile,
  onGetDirections,
}) => {
  if (!checkIn) return null;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getExpiresIn = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const expires = new Date(expiresAt);
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins <= 0) return 'Expired';
    if (diffMins < 60) return `${diffMins}m remaining`;
    return `${diffHours}h ${diffMins % 60}m remaining`;
  };

  const isExpired = checkIn.expires_at
    ? new Date(checkIn.expires_at).getTime() < Date.now()
    : false;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.bottomSheet}>
              {/* Handle bar */}
              <View style={styles.handleBar} />

              {/* Activity Tag Badge */}
              {checkIn.activity_tag && (
                <View style={styles.activityBadge}>
                  <Ionicons
                    name={getActivityTag(checkIn.activity_tag)?.icon || 'location'}
                    size={16}
                    color="#4CAF50"
                  />
                  <Text style={styles.activityBadgeText}>
                    {getActivityTag(checkIn.activity_tag)?.label || 'Activity'}
                  </Text>
                </View>
              )}

              {/* Location Info */}
              <View style={styles.locationSection}>
                <View style={styles.locationIcon}>
                  <Ionicons
                    name={checkIn.activity_tag
                      ? (getActivityTag(checkIn.activity_tag)?.icon || 'location')
                      : 'location'}
                    size={24}
                    color="#4CAF50"
                  />
                </View>
                <View style={styles.locationInfo}>
                  <Text style={styles.locationName}>{checkIn.location_name}</Text>
                  <Text style={styles.checkInTime}>
                    Checked in {formatTime(checkIn.created_at)}
                  </Text>
                  {checkIn.expires_at && (
                    <Text style={styles.expiresText}>
                      {getExpiresIn(checkIn.expires_at)}
                    </Text>
                  )}
                </View>
              </View>

              {/* Description */}
              {checkIn.description && (
                <View style={styles.descriptionSection}>
                  <Text style={styles.description}>"{checkIn.description}"</Text>
                </View>
              )}

              {/* User Info */}
              {checkIn.profiles && (
                <TouchableOpacity
                  style={styles.userSection}
                  onPress={() => onViewProfile(checkIn.profiles!.id)}
                >
                  <View style={styles.userAvatar}>
                    {checkIn.profiles.photos && checkIn.profiles.photos.length > 0 ? (
                      <Image
                        source={{ uri: checkIn.profiles.photos[0] }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Ionicons name="person" size={24} color="white" />
                      </View>
                    )}
                    {/* Online indicator */}
                    <View style={styles.onlineIndicator} />
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {checkIn.profiles.name}
                      {checkIn.profiles.age && `, ${checkIn.profiles.age}`}
                    </Text>
                    {checkIn.profiles.bio && (
                      <Text style={styles.userBio} numberOfLines={2}>
                        {checkIn.profiles.bio}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
              )}

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                {checkIn.profiles && (
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => onViewProfile(checkIn.profiles!.id)}
                  >
                    <Ionicons name="person" size={20} color="white" />
                    <Text style={styles.primaryButtonText}>View Profile</Text>
                  </TouchableOpacity>
                )}
                {onGetDirections && (
                  <TouchableOpacity
                    style={[styles.secondaryButton, isExpired && styles.disabledButton]}
                    onPress={() => !isExpired && onGetDirections(checkIn.latitude, checkIn.longitude)}
                    disabled={isExpired}
                  >
                    <Ionicons name="navigate" size={20} color={isExpired ? '#999' : '#4CAF50'} />
                    <Text style={[styles.secondaryButtonText, isExpired && styles.disabledButtonText]}>
                      {isExpired ? 'Expired' : 'View on Map'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Close Button */}
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: '80%',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  activityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFF0F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
    gap: 6,
  },
  activityBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  locationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF0F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  checkInTime: {
    fontSize: 14,
    color: '#666',
  },
  expiresText: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 2,
  },
  descriptionSection: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    color: '#555',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  userAvatar: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: 'white',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  userBio: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#4CAF50',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    borderColor: '#DDD',
    backgroundColor: '#F5F5F5',
  },
  disabledButtonText: {
    color: '#999',
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  closeButtonText: {
    color: '#999',
    fontSize: 16,
  },
});

export default CheckInDetailModal;
