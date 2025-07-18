import addAxiosShimToContext from './axios.js';
import addNanoidShimToContext from './nanoid.js';
import addPathShimToContext from './path.js';
import addUuidShimToContext from './uuid.js';

const addLibraryShimsToContext = async (vm) => {
  await addNanoidShimToContext(vm);
  await addAxiosShimToContext(vm);
  await addUuidShimToContext(vm);
  await addPathShimToContext(vm);
};

export default addLibraryShimsToContext;
