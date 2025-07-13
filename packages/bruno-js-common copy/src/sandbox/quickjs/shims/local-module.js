import path from 'path';
import { marshallToVm } from '../utils/index.js';

const doesFileExist = (path) => { return false; } // ?
const getFileContents = (path) => { return ''; } // ?

const addLocalModuleLoaderShimToContext = (vm, collectionPath) => {
  let loadLocalModuleHandle = vm.newFunction('loadLocalModule', function (module) {
    const filename = vm.dump(module);

    // Check if the filename has an extension
    const hasExtension = path.extname(filename) !== '';
    const resolvedFilename = hasExtension ? filename : `${filename}.js`;

    // Resolve the file path and check if it's within the collectionPath
    const filePath = path.resolve(collectionPath, resolvedFilename);
    const relativePath = path.relative(collectionPath, filePath);

    // Ensure the resolved file path is inside the collectionPath
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error('Access to files outside of the collectionPath is not allowed.');
    }

    if (!doesFileExist(filePath)) {
      throw new Error(`Cannot find module ${filename}`);
    }

    let code = getFileContents(filePath).toString();

    return marshallToVm(code, vm);
  });

  vm.setProp(vm.global, '__brunoLoadLocalModule', loadLocalModuleHandle);
  loadLocalModuleHandle.dispose();
};

export default addLocalModuleLoaderShimToContext;
