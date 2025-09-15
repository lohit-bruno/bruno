const addAxiosShimToContext = require('./axios');
const addCryptoUtilsShimToContext = require('./crypto-utils');
const addNanoidShimToContext = require('./nanoid');
const addPathShimToContext = require('./path');
const addTextUtilsShimToContext = require('./text-utils');
const addUuidShimToContext = require('./uuid');

const addLibraryShimsToContext = async (vm) => {
  await addNanoidShimToContext(vm);
  await addAxiosShimToContext(vm);
  await addCryptoUtilsShimToContext(vm);
  await addTextUtilsShimToContext(vm);
  await addUuidShimToContext(vm);
  await addPathShimToContext(vm);
};

module.exports = addLibraryShimsToContext;
