import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1900; // Leave some buffer below 2048 bytes

export const ChunkedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    try {
      const chunkCount = await SecureStore.getItemAsync(`${key}_chunks`);
      if (!chunkCount) {
        // Try to get the item directly (for backwards compatibility)
        return await SecureStore.getItemAsync(key);
      }

      const chunks: string[] = [];
      for (let i = 0; i < parseInt(chunkCount); i++) {
        const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
        if (chunk) {
          chunks.push(chunk);
        }
      }
      
      return chunks.join('');
    } catch (error) {
      console.error('Error getting item from chunked secure store:', error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      // If the value is small enough, store it directly
      if (value.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
        // Clean up any existing chunks
        await this.removeChunks(key);
        return;
      }

      // Split the value into chunks
      const chunks: string[] = [];
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.substring(i, i + CHUNK_SIZE));
      }

      // Store the number of chunks
      await SecureStore.setItemAsync(`${key}_chunks`, chunks.length.toString());

      // Store each chunk
      for (let i = 0; i < chunks.length; i++) {
        await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
      }

      // Remove the original key if it exists
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (error) {
        // Ignore if the key doesn't exist
      }
    } catch (error) {
      console.error('Error setting item in chunked secure store:', error);
      throw error;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      // Remove the main item
      await SecureStore.deleteItemAsync(key);
      
      // Remove chunks
      await this.removeChunks(key);
    } catch (error) {
      console.error('Error removing item from chunked secure store:', error);
      throw error;
    }
  },

  private async removeChunks(key: string): Promise<void> {
    try {
      const chunkCount = await SecureStore.getItemAsync(`${key}_chunks`);
      if (chunkCount) {
        const count = parseInt(chunkCount);
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
        }
        await SecureStore.deleteItemAsync(`${key}_chunks`);
      }
    } catch (error) {
      // Ignore errors when cleaning up chunks
    }
  },
};