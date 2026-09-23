import { autoMergeDuplicateDosen } from '../services/sia/dosenMerge.service';

const run = async () => {
  try {
    await autoMergeDuplicateDosen();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
};

run();
