import { DataRepository } from './DataRepository';
import { CloudDataRepository } from './CloudDataRepository';
import { LocalDataRepository } from './LocalDataRepository';
import { useStore } from '../store/useStore';
import { auth } from '../firebase';

export const RepositoryProvider = {
  getRepository(): DataRepository {
    const isCloudEnabled = useStore.getState().isMigratedToCloud;
    const hasUser = !!auth.currentUser;
    
    if (isCloudEnabled && hasUser) {
      return CloudDataRepository;
    }
    return LocalDataRepository;
  }
};
