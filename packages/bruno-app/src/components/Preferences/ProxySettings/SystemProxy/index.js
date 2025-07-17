import { getSystemProxyVariables } from "providers/ReduxStore/slices/app";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

const SystemProxy = () => {
  const dispatch = useDispatch();
  const systemProxyVariables = useSelector((state) => state.app.systemProxyVariables);
  const { source, http_proxy, https_proxy, no_proxy } = systemProxyVariables || {};

  useEffect(() => {
    dispatch(getSystemProxyVariables());
  }, []);

  return (
    <>
      {formik.values.mode === 'system' && (
        <div className="mb-3 pt-1 text-muted system-proxy-settings">
          <small>
            Below values are sourced from your system proxy settings and cannot be directly updated in Bruno.<br />
            Please refer to your OS documentation to change these values.
          </small>
          {source && (
            <div className="mt-2 mb-2">
              <small className="text-blue-600 font-medium">
                Proxy source: {source === 'environment' ? 'Environment Variables' :
                  source === 'windows-system' ? 'Windows System Settings' :
                    source === 'macos-system' ? 'macOS System Settings' :
                      source === 'linux-system' ? 'Linux System Settings' : source}
              </small>
            </div>
          )}
          <div className="flex flex-col justify-start items-start pt-2">
            <div className="mb-1 flex items-center">
              <label className="settings-label">
                http_proxy
              </label>
              <div className="opacity-80">{http_proxy || '-'}</div>
            </div>
            <div className="mb-1 flex items-center">
              <label className="settings-label">
                https_proxy
              </label>
              <div className="opacity-80">{https_proxy || '-'}</div>
            </div>
            <div className="mb-1 flex items-center">
              <label className="settings-label">
                no_proxy
              </label>
              <div className="opacity-80">{no_proxy || '-'}</div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SystemProxy;