import { getSystemProxyVariables } from 'providers/ReduxStore/slices/app';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import HeaderSection from './HeaderSection';

const SystemProxy = () => {
  const dispatch = useDispatch();
  const systemProxyVariables = useSelector((state) => state.app.systemProxyVariables);
  const { source, http_proxy, https_proxy, no_proxy } = systemProxyVariables || {};

  useEffect(() => {
    dispatch(getSystemProxyVariables());
  }, [dispatch]);

  return (
    <>
      <div className="mb-3 text-muted system-proxy-settings space-y-4">
        <HeaderSection />
        {source && (
          <div className="mb-2">
            <small className="font-medium flex flex-row gap-2">
              <div className="opacity-70 text-xs">
                Proxy source:
              </div>
              <div>
                {source === 'environment' ? 'Environment Variables'
                  : source === 'windows-system' ? 'Windows System Settings'
                    : source === 'macos-system' ? 'macOS System Settings'
                      : source === 'linux-system' ? 'Linux System Settings' : source}
              </div>
            </small>
          </div>
        )}
        <small>
          These values cannot be directly updated in Bruno. Please refer to your OS documentation to update these.
        </small>
        <div className="flex flex-col justify-start items-start pt-2">
          <div className="mb-1 flex items-center">
            <label className="settings-label">
              http_proxy
            </label>
            <div className="opacity-80 text-indigo-600 dark:text-indigo-400">{http_proxy || '-'}</div>
          </div>
          <div className="mb-1 flex items-center">
            <label className="settings-label">
              https_proxy
            </label>
            <div className="opacity-80 text-indigo-600 dark:text-indigo-400">{https_proxy || '-'}</div>
          </div>
          <div className="mb-1 flex items-center">
            <label className="settings-label">
              no_proxy
            </label>
            <div className="opacity-80 text-indigo-600 dark:text-indigo-400">{no_proxy || '-'}</div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SystemProxy;
