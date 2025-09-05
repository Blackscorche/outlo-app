import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

interface EmoticonPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectEmoticon: (emoticon: string) => void;
}

const EmoticonPicker: React.FC<EmoticonPickerProps> = ({
  visible,
  onClose,
  onSelectEmoticon,
}) => {
  const emoticons = [
    // Basic Smileys
    '😀', '😃', '😄', '😁', '😅', '😂', '😊', '😇', '🙂', '🙃',
    '😉', '😌', '😍', '😘', '😗', '😙', '😚', '😋', '😛', '😝',
    '😜', '😎', '😏', '😒', '😞', '😔', '😟', '😕', '😣', '😖',
    '😫', '😩', '😢', '😭', '😤', '😠', '😡', '😳', '😱', '😨',
    '😰', '😥', '😓', '🤗', '🤔', '🤤', '🤢', '😷', '🤒', '🤕',
    
    // Hearts & Love
    '❤️', '💛', '💚', '💙', '💜', '🖤', '💔', '💕', '💞', '💓',
    '💗', '💖', '💘', '💝', '💟',
    
    // Hand Gestures
    '👍', '👎', '👌', '✌️', '👋', '🤚', '✋', '👏', '🙌', '👐',
    '🤝', '🙏', '👈', '👉', '👆', '👇', '☝️',
    
    // Common Objects & Symbols
    '🎉', '🎊', '🎈', '🎁', '🎂', '🍰', '🍕', '🍔', '🍟', '🌭',
    '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🥝', '🍍',
    '☀️', '🌙', '⭐', '🌟', '💫', '🔥', '💯', '✨', '⚡', '🌈',
    '🚗', '✈️', '🚀', '🎵', '🎶', '📱', '💻', '📷', '🎮', '⚽',
    '🏀', '🎾', '⚾', '🏈', '🎳', '🎯', '🎲', '🃏', '🎭', '🎨',
  ];

  const renderEmoticon = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={styles.emoticonButton}
      onPress={() => {
        console.log('Emoticon pressed:', item);
        onSelectEmoticon(item);
        onClose();
      }}
    >
      <Text style={styles.emoticonText}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose Emoticon</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        
        <FlatList
          data={emoticons}
          renderItem={renderEmoticon}
          keyExtractor={(item, index) => `${item}-${index}`}
          numColumns={8}
          contentContainerStyle={styles.emoticonGrid}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>
    </Modal>
  );
};

const { width } = Dimensions.get('window');
const emoticonSize = (width - (theme.spacing.md * 2) - (theme.spacing.xs * 7)) / 8;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  emoticonGrid: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  emoticonButton: {
    width: emoticonSize,
    height: emoticonSize,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  emoticonText: {
    fontSize: 24,
  },
});

export default EmoticonPicker;