import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ImageViewerProps {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

export default function ImageViewer({
  visible,
  images,
  initialIndex = 0,
  onClose,
}: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageLoading, setImageLoading] = useState<{ [key: number]: boolean }>({});

  const renderImage = ({ item, index }: { item: string; index: number }) => {
    return (
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item }}
          style={styles.fullImage}
          resizeMode="contain"
          onLoadStart={() => setImageLoading(prev => ({ ...prev, [index]: true }))}
          onLoadEnd={() => setImageLoading(prev => ({ ...prev, [index]: false }))}
        />
        {imageLoading[index] && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="white" />
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          <Text style={styles.counter}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>

        {/* Images */}
        <FlatList
          data={images}
          renderItem={renderImage}
          keyExtractor={(item, index) => index.toString()}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const newIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
            setCurrentIndex(newIndex);
          }}
          initialScrollIndex={initialIndex}
          getItemLayout={(data, index) => ({
            length: screenWidth,
            offset: screenWidth * index,
            index,
          })}
        />

        {/* Dots indicator */}
        {images.length > 1 && (
          <View style={styles.dotsContainer}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentIndex && styles.activeDot,
                ]}
              />
            ))}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  closeButton: {
    padding: 10,
  },
  counter: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  imageContainer: {
    width: screenWidth,
    height: screenHeight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
  loadingContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: 'white',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});