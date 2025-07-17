import { useFormik } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import { savePreferences } from "providers/ReduxStore/slices/app";
import { useDispatch, useSelector } from "react-redux";
import CustomProxyConfig from "./config";
import ToggleSwitch from 'components/ToggleSwitch/index';
import { 
  IconWorld, 
  IconShield, 
  IconLock, 
  IconServer, 
  IconNetwork,
  IconInfoCircle,
  IconChevronDown,
  IconChevronRight
} from '@tabler/icons';
import { useState } from 'react';

const CustomProxy = () => {
  const dispatch = useDispatch();
  const preferences = useSelector((state) => state.app.preferences);
  const proxyPreferences = preferences.proxy;

  // State to track active tab
  const [activeTab, setActiveTab] = useState('http');

  // State to track collapsed sections - default to collapsed for compact modal view
  const [collapsedSections, setCollapsedSections] = useState({
    http: true,
    https: true,
    socks: true
  });

  const proxySchema = Yup.object({
    bypassProxy: Yup.string().optional().max(1024),
    configs: Yup.object({
      http: Yup.object({
        enabled: Yup.boolean(),
        hostname: Yup.string().when('enabled', {
          is: true,
          then: (schema) => schema.required('Hostname is required'),
          otherwise: (schema) => schema.nullable()
        }).max(1024),
        port: Yup.number().min(1).max(65535).nullable().when('enabled', {
          is: true,
          then: (schema) => schema.required('Port is required'),
          otherwise: (schema) => schema.nullable()
        }),
        auth: Yup.object({
          enabled: Yup.boolean(),
          username: Yup.string().when('enabled', {
            is: true,
            then: (schema) => schema.required('Username is required'),
            otherwise: (schema) => schema.nullable()
          }).max(1024),
          password: Yup.string().when('enabled', {
            is: true,
            then: (schema) => schema.required('Password is required'),
            otherwise: (schema) => schema.nullable()
          }).max(1024)
        })
      }),
      https: Yup.object({
        enabled: Yup.boolean(),
        hostname: Yup.string().when('enabled', {
          is: true,
          then: (schema) => schema.required('Hostname is required'),
          otherwise: (schema) => schema.nullable()
        }).max(1024),
        port: Yup.number().min(1).max(65535).nullable().when('enabled', {
          is: true,
          then: (schema) => schema.required('Port is required'),
          otherwise: (schema) => schema.nullable()
        }),
        auth: Yup.object({
          enabled: Yup.boolean(),
          username: Yup.string().when('enabled', {
            is: true,
            then: (schema) => schema.required('Username is required'),
            otherwise: (schema) => schema.nullable()
          }).max(1024),
          password: Yup.string().when('enabled', {
            is: true,
            then: (schema) => schema.required('Password is required'),
            otherwise: (schema) => schema.nullable()
          }).max(1024)
        })
      }),
      socks: Yup.object({
        enabled: Yup.boolean(),
        // protocol: Yup.string().oneOf(['socks4', 'socks5']),
        hostname: Yup.string().when('enabled', {
          is: true,
          then: (schema) => schema.required('Hostname is required'),
          otherwise: (schema) => schema.nullable()
        }).max(1024),
        port: Yup.number().min(1).max(65535).nullable().when('enabled', {
          is: true,
          then: (schema) => schema.required('Port is required'),
          otherwise: (schema) => schema.nullable()
        }),
        auth: Yup.object({
          enabled: Yup.boolean(),
          username: Yup.string().when('enabled', {
            is: true,
            then: (schema) => schema.required('Username is required'),
            otherwise: (schema) => schema.nullable()
          }).max(1024),
          password: Yup.string().when('enabled', {
            is: true,
            then: (schema) => schema.required('Password is required'),
            otherwise: (schema) => schema.nullable()
          }).max(1024)
        })
      })
    })
  });

  const formik = useFormik({
    initialValues: {
      // mode: proxyPreferences.mode || 'off',
      bypassProxy: proxyPreferences.bypassProxy || '',
      configs: {
        http: {
          enabled: proxyPreferences.configs?.http?.enabled || false,
          hostname: proxyPreferences.configs?.http?.hostname || '',
          port: proxyPreferences.configs?.http?.port || '',
          auth: {
            enabled: proxyPreferences.configs?.http?.auth?.enabled || false,
            username: proxyPreferences.configs?.http?.auth?.username || '',
            password: proxyPreferences.configs?.http?.auth?.password || ''
          }
        },
        https: {
          enabled: proxyPreferences.configs?.https?.enabled || false,
          hostname: proxyPreferences.configs?.https?.hostname || '',
          port: proxyPreferences.configs?.https?.port || '',
          auth: {
            enabled: proxyPreferences.configs?.https?.auth?.enabled || false,
            username: proxyPreferences.configs?.https?.auth?.username || '',
            password: proxyPreferences.configs?.https?.auth?.password || ''
          }
        },
        socks: {
          enabled: proxyPreferences.configs?.socks?.enabled || false,
          // protocol: proxyPreferences.configs?.socks?.protocol || 'socks5',
          hostname: proxyPreferences.configs?.socks?.hostname || '',
          port: proxyPreferences.configs?.socks?.port || '',
          auth: {
            enabled: proxyPreferences.configs?.socks?.auth?.enabled || false,
            username: proxyPreferences.configs?.socks?.auth?.username || '',
            password: proxyPreferences.configs?.socks?.auth?.password || ''
          }
        }
      }
    },
    validationSchema: proxySchema,
    onSubmit: (values) => {
      onUpdate(values);
    }
  });

  const onUpdate = (values) => {
    proxySchema
      .validate(values, { abortEarly: true })
      .then((validatedProxy) => {
        dispatch(
          savePreferences({
            ...preferences,
            proxy: {
              ...proxyPreferences,
              ...validatedProxy
            }
          })
        ).then(() => {
          toast.success('Preferences saved successfully');
          // close();
        }).catch(() => {
          toast.error('Failed to save preferences');
        });
      })
      .catch((error) => {
        let errMsg = error.message || 'Preferences validation error';
        toast.error(errMsg);
      });
  };

  console.log(formik.values.configs);

  const toggleCollapse = (type) => {
    setCollapsedSections(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  // Generate proxy URL preview
  const getProxyPreview = (type, config) => {
    if (!config.enabled || !config.hostname || !config.port) {
      return 'Not configured';
    }
    
    const protocol = type === 'socks' ? 'socks' : type;
    const auth = config.auth?.enabled && config.auth?.username ? `${config.auth.username}@` : '';
    return `${protocol}://${auth}${config.hostname}:${config.port}`;
  };

  const proxyTypes = [
    {
      type: 'http',
      label: 'HTTP',
      icon: IconWorld,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      description: 'Proxy for HTTP requests'
    },
    {
      type: 'https',
      label: 'HTTPS',
      icon: IconShield,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
      description: 'Secure proxy for HTTPS requests'
    },
    {
      type: 'socks',
      label: 'SOCKS',
      icon: IconServer,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800',
      description: 'SOCKS4/5 proxy protocol'
    }
  ];

  const activeProxyType = proxyTypes.find(p => p.type === activeTab);
  const activeConfig = formik.values?.configs?.[activeTab];
  const activeErrors = formik.errors?.configs?.[activeTab];

  return (
    <div className="space-y-4">
      {/* Compact Header Section */}
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
          <IconNetwork size={16} strokeWidth={1.5} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Custom Proxy Configuration
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Configure proxy settings for different protocols
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-0" aria-label="Proxy Types">
          {proxyTypes.map((proxyType) => {
            const { type, label, icon: Icon, color, bgColor, borderColor } = proxyType;
            const isActive = activeTab === type;
            const isEnabled = formik.values?.configs?.[type]?.enabled;
            const config = formik.values?.configs?.[type];
            const proxyPreview = getProxyPreview(type, config);
            
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={`relative flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-all duration-200 ${
                  isActive
                    ? `${borderColor} ${color} bg-gray-50 dark:bg-gray-800/50`
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-5 h-5 rounded ${
                    isActive && isEnabled ? bgColor : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    <Icon 
                      size={12} 
                      strokeWidth={1.5} 
                      className={isActive && isEnabled ? color : 'text-gray-400 dark:text-gray-500'} 
                    />
                  </div>
                  <span>{label}</span>
                  {isEnabled && (
                    <span className={`inline-flex items-center w-2 h-2 rounded-full ${
                      isActive ? bgColor : 'bg-green-400'
                    }`} />
                  )}
                </div>
                
                {/* Tab preview/status */}
                <div className="mt-1">
                  <p className={`text-xs truncate ${
                    isEnabled && proxyPreview !== 'Not configured'
                      ? 'text-gray-600 dark:text-gray-400 font-mono'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {isEnabled ? proxyPreview : 'Disabled'}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active Tab Content */}
      <div className="space-y-4">
        {/* Proxy Enable/Disable Toggle */}
        <div className={`rounded-lg border p-4 transition-all duration-200 ${
          activeConfig?.enabled 
            ? `${activeProxyType.borderColor} ${activeProxyType.bgColor}` 
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-8 h-8 rounded-md ${
                activeConfig?.enabled ? activeProxyType.bgColor : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                <activeProxyType.icon 
                  size={16} 
                  strokeWidth={1.5} 
                  className={activeConfig?.enabled ? activeProxyType.color : 'text-gray-400 dark:text-gray-500'} 
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${
                    activeConfig?.enabled 
                      ? 'text-gray-900 dark:text-gray-100' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {activeProxyType.label} Proxy
                  </span>
                  {activeConfig?.enabled && (
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      activeProxyType.bgColor
                    } ${activeProxyType.color}`}>
                      Enabled
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {activeProxyType.description}
                </p>
              </div>
            </div>
            <ToggleSwitch
              id={activeTab}
              isOn={activeConfig?.enabled || false}
              size="sm"
              handleToggle={(e) => {
                formik.setFieldValue(`configs.${activeTab}.enabled`, e.target.checked);
              }}
            />
          </div>
        </div>

        {/* Configuration Content */}
        {activeConfig?.enabled && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <CustomProxyConfig 
              type={activeTab}
              config={activeConfig} 
              errors={activeErrors} 
              setValue={formik.setFieldValue}
              themeColors={{
                color: activeProxyType.color,
                bgColor: activeProxyType.bgColor,
                borderColor: activeProxyType.borderColor
              }}
            />
          </div>
        )}
      </div>

      {/* Bypass Proxy Section */}
      <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2">
        <div className="flex items-center gap-2 mb-2">
          <IconInfoCircle size={14} strokeWidth={1.5} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Bypass Proxy (Optional)
          </span>
        </div>
        <input
          type="text"
          name="bypassProxy"
          className="block w-full textbox text-sm"
          value={formik.values.bypassProxy}
          onChange={formik.handleChange}
          placeholder="localhost, 127.0.0.1, *.example.com"
        />
        {formik.errors.bypassProxy && (
          <div className="mt-1 text-red-500 text-xs">{formik.errors.bypassProxy}</div>
        )}
      </div>
    </div>
  );
}

export default CustomProxy;