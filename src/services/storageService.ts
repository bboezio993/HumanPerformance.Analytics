import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

export const StorageService = {
  async uploadFile(file: File | Blob, storagePath: string): Promise<{ url: string; size: number; contentType: string; storagePath: string }> {
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return {
      url,
      storagePath,
      size: file.size,
      contentType: file.type
    };
  },

  async deleteFile(storagePath: string): Promise<void> {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  }
};
