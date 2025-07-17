const { ipcMain } = require('electron');
const { getPreferences, savePreferences, preferencesUtil } = require('../store/preferences');
const { isDirectory } = require('../utils/filesystem');
const { openCollection } = require('../app/collections');
const { globalEnvironmentsStore } = require('../store/global-environments');
const { getSystemProxy } = require('@usebruno/requests').utils;
``;
const registerPreferencesIpc = (mainWindow, watcher, lastOpenedCollections) => {
  ipcMain.handle('renderer:ready', async (event) => {
    // load preferences
    const preferences = getPreferences();
    mainWindow.webContents.send('main:load-preferences', preferences);

    // load global environments
    const globalEnvironments = globalEnvironmentsStore.getGlobalEnvironments();
    let activeGlobalEnvironmentUid = globalEnvironmentsStore.getActiveGlobalEnvironmentUid();
    activeGlobalEnvironmentUid = globalEnvironments?.find(env => env?.uid == activeGlobalEnvironmentUid) ? activeGlobalEnvironmentUid : null;
    mainWindow.webContents.send('main:load-global-environments', { globalEnvironments, activeGlobalEnvironmentUid });

    // reload last opened collections
    const lastOpened = lastOpenedCollections.getAll();

    if (lastOpened && lastOpened.length) {
      for (let collectionPath of lastOpened) {
        if (isDirectory(collectionPath)) {
          await openCollection(mainWindow, watcher, collectionPath, {
            dontSendDisplayErrors: true,
            forceRefreshWatcher: true
          });
        }
      }
    }
  });

  ipcMain.on('main:open-preferences', () => {
    mainWindow.webContents.send('main:open-preferences');
  });

  ipcMain.handle('renderer:save-preferences', async (event, preferences) => {
    try {
      await savePreferences(preferences);
    } catch (error) {
      return Promise.reject(error);
    }
  });

  ipcMain.handle('renderer:get-system-proxy-variables', async () => {
    const systemProxyConfig = await getSystemProxy(); // ?
    return systemProxyConfig;
  });
};

module.exports = registerPreferencesIpc;
