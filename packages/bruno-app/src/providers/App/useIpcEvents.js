import { useEffect } from 'react';
import {
  showPreferences,
  updateCookies,
  updatePreferences,
  updateSystemProxyEnvVariables
} from 'providers/ReduxStore/slices/app';
import {
  brunoConfigUpdateEvent,
  collectionAddDirectoryEvent,
  collectionAddFileEvent,
  collectionChangeFileEvent,
  collectionRenamedEvent,
  collectionUnlinkDirectoryEvent,
  collectionUnlinkEnvFileEvent,
  collectionUnlinkFileEvent,
  processEnvUpdateEvent,
  runFolderEvent,
  runRequestEvent,
  scriptEnvironmentUpdateEvent
} from 'providers/ReduxStore/slices/collections';
import { collectionAddEnvFileEvent, openCollectionEvent, hydrateCollectionWithUiStateSnapshot } from 'providers/ReduxStore/slices/collections/actions';
import toast from 'react-hot-toast';
import { useDispatch } from 'react-redux';
import { isElectron } from 'utils/common/platform';
import { globalEnvironmentsUpdateEvent, updateGlobalEnvironments } from 'providers/ReduxStore/slices/global-environments';
import { collectionAddOauth2CredentialsByUrl, collectionVerifyFileEvent } from 'providers/ReduxStore/slices/collections/index';

const BATCH_SIZE = 10;

const useIpcEvents = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!isElectron()) {
      return () => {};
    }

    const { ipcRenderer } = window;

    // Queue to store dispatch events
    let dispatchQueue = [];

    // Process queue in batches of 10
    const processQueue = () => {
      if (dispatchQueue.length === 0) return;
      
      const batch = dispatchQueue.slice(0, BATCH_SIZE);
      dispatchQueue = dispatchQueue.slice(BATCH_SIZE);

      batch.forEach(action => {
        dispatch(action);
      });

      if (dispatchQueue.length > 0) {
        setTimeout(processQueue, 0);
      }
    };

    // Helper to add actions to queue
    const queueDispatch = (action) => {
      dispatchQueue.push(action);
      if (dispatchQueue.length === 1) {
        setTimeout(processQueue, 0);
      }
    };

    const _collectionTreeUpdated = (type, val) => {
      if (window.__IS_DEV__) {
        console.log(type);
        console.log(val);
      }
      if (type === 'addDir') {
        queueDispatch(
          collectionAddDirectoryEvent({
            dir: val
          })
        );
      }
      if (type === 'addFile') {
        queueDispatch(
          collectionAddFileEvent({
            file: val
          })
        );
      }
      if (type === 'verifyFile') {
        queueDispatch(
          collectionVerifyFileEvent({
            file: val
          })
        );
      }
      if (type === 'change') {
        queueDispatch(
          collectionChangeFileEvent({
            file: val
          })
        );
      }
      if (type === 'unlink') {
        setTimeout(() => {
          queueDispatch(
            collectionUnlinkFileEvent({
              file: val
            })
          );
        }, 100);
      }
      if (type === 'unlinkDir') {
        queueDispatch(
          collectionUnlinkDirectoryEvent({
            directory: val
          })
        );
      }
      if (type === 'addEnvironmentFile') {
        queueDispatch(collectionAddEnvFileEvent(val));
      }
      if (type === 'unlinkEnvironmentFile') {
        queueDispatch(collectionUnlinkEnvFileEvent(val));
      }
    };

    ipcRenderer.invoke('renderer:ready');

    const removeCollectionTreeUpdateListener = ipcRenderer.on('main:collection-tree-updated', _collectionTreeUpdated);

    const removeOpenCollectionListener = ipcRenderer.on('main:collection-opened', (pathname, uid, brunoConfig) => {
      queueDispatch(openCollectionEvent(uid, pathname, brunoConfig));
    });

    const removeCollectionAlreadyOpenedListener = ipcRenderer.on('main:collection-already-opened', (pathname) => {
      toast.success('Collection is already opened');
    });

    const removeDisplayErrorListener = ipcRenderer.on('main:display-error', (error) => {
      if (typeof error === 'string') {
        return toast.error(error || 'Something went wrong!');
      }
      if (typeof error === 'object') {
        return toast.error(error.message || 'Something went wrong!');
      }
    });

    const removeScriptEnvUpdateListener = ipcRenderer.on('main:script-environment-update', (val) => {
      queueDispatch(scriptEnvironmentUpdateEvent(val));
    });

    const removeGlobalEnvironmentVariablesUpdateListener = ipcRenderer.on('main:global-environment-variables-update', (val) => {
      queueDispatch(globalEnvironmentsUpdateEvent(val));
    });

    const removeCollectionRenamedListener = ipcRenderer.on('main:collection-renamed', (val) => {
      queueDispatch(collectionRenamedEvent(val));
    });

    const removeRunFolderEventListener = ipcRenderer.on('main:run-folder-event', (val) => {
      queueDispatch(runFolderEvent(val));
    });

    const removeRunRequestEventListener = ipcRenderer.on('main:run-request-event', (val) => {
      queueDispatch(runRequestEvent(val));
    });

    const removeProcessEnvUpdatesListener = ipcRenderer.on('main:process-env-update', (val) => {
      queueDispatch(processEnvUpdateEvent(val));
    });

    const removeConsoleLogListener = ipcRenderer.on('main:console-log', (val) => {
      console[val.type](...val.args);
    });

    const removeConfigUpdatesListener = ipcRenderer.on('main:bruno-config-update', (val) =>
      queueDispatch(brunoConfigUpdateEvent(val))
    );

    const removeShowPreferencesListener = ipcRenderer.on('main:open-preferences', () => {
      queueDispatch(showPreferences(true));
    });

    const removePreferencesUpdatesListener = ipcRenderer.on('main:load-preferences', (val) => {
      queueDispatch(updatePreferences(val));
    });

    const removeSystemProxyEnvUpdatesListener = ipcRenderer.on('main:load-system-proxy-env', (val) => {
      queueDispatch(updateSystemProxyEnvVariables(val));
    });

    const removeCookieUpdateListener = ipcRenderer.on('main:cookies-update', (val) => {
      queueDispatch(updateCookies(val));
    });

    const removeGlobalEnvironmentsUpdatesListener = ipcRenderer.on('main:load-global-environments', (val) => {
      queueDispatch(updateGlobalEnvironments(val));
    });

    const removeSnapshotHydrationListener = ipcRenderer.on('main:hydrate-app-with-ui-state-snapshot', (val) => {
      queueDispatch(hydrateCollectionWithUiStateSnapshot(val));
    });

    const removeCollectionOauth2CredentialsUpdatesListener = ipcRenderer.on('main:credentials-update', (val) => {
      const payload = {
        ...val,
        itemUid: val.itemUid || null,
        folderUid: val.folderUid || null,
        credentialsId: val.credentialsId || 'credentials'
      };
      queueDispatch(collectionAddOauth2CredentialsByUrl(payload));
    });

    return () => {
      removeCollectionTreeUpdateListener();
      removeOpenCollectionListener();
      removeCollectionAlreadyOpenedListener();
      removeDisplayErrorListener();
      removeScriptEnvUpdateListener();
      removeGlobalEnvironmentVariablesUpdateListener();
      removeCollectionRenamedListener();
      removeRunFolderEventListener();
      removeRunRequestEventListener();
      removeProcessEnvUpdatesListener();
      removeConsoleLogListener();
      removeConfigUpdatesListener();
      removeShowPreferencesListener();
      removePreferencesUpdatesListener();
      removeCookieUpdateListener();
      removeSystemProxyEnvUpdatesListener();
      removeGlobalEnvironmentsUpdatesListener();
      removeSnapshotHydrationListener();
      removeCollectionOauth2CredentialsUpdatesListener();
    };
  }, [isElectron]);
};

export default useIpcEvents;
