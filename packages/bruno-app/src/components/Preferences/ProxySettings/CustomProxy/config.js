import ToggleSwitch from "components/ToggleSwitch/index";
import { 
  IconServer, 
  IconKey, 
  IconUser, 
  IconEye, 
  IconEyeOff,
  IconWorldWww,
  IconPlug
} from '@tabler/icons';
import { useState } from 'react';

const CustomProxyConfig = ({ type, config = {}, errors = {}, setValue, themeColors = {} }) => {
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleChange = e => {
    e.preventDefault();
    setValue(e.target.name, e.target.value);
  };

  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };

  const { color = 'text-gray-600', bgColor = 'bg-gray-50', borderColor = 'border-gray-200' } = themeColors;

  return (
    <div className="space-y-4">
      {/* Server Configuration Section */}
      <div className="space-y-3">
        {/* <div className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-5 h-5 rounded ${bgColor}`}>
            <IconServer size={12} strokeWidth={1.5} className={color} />
          </div>
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Server Configuration
          </h4>
        </div> */}

        <div className="grid grid-cols-2 gap-3">
          {/* Hostname Field */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <IconWorldWww size={14} strokeWidth={1.5} className="text-gray-400" />
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Hostname
              </label>
            </div>
            <input
              type="text"
              name={`configs.${type}.hostname`}
              className={`block w-full textbox ${errors.hostname ? 'border-red-300 focus:border-red-500' : ''}`}
              value={config.hostname}
              onChange={handleChange}
              placeholder="proxy.example.com"
            />
            {errors.hostname && (
              <div className="flex items-center gap-1 text-red-500 text-xs">
                <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                {errors.hostname}
              </div>
            )}
          </div>

          {/* Port Field */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <IconPlug size={14} strokeWidth={1.5} className="text-gray-400" />
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Port
              </label>
            </div>
            <input
              type="number"
              name={`configs.${type}.port`}
              className={`block w-full textbox ${errors.port ? 'border-red-300 focus:border-red-500' : ''}`}
              value={config.port}
              onChange={handleChange}
              placeholder="8080"
              min="1"
              max="65535"
            />
            {errors.port && (
              <div className="flex items-center gap-1 text-red-500 text-xs">
                <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                {errors.port}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Authentication Section */}
      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-5 h-5 rounded ${
              config.auth.enabled ? bgColor : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <IconKey 
                size={12} 
                strokeWidth={1.5} 
                className={config.auth.enabled ? color : 'text-gray-400'} 
              />
            </div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Authentication
            </h4>
            {config.auth.enabled && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${bgColor} ${color}`}>
                Required
              </span>
            )}
          </div>
          <ToggleSwitch
            id={`${type}-auth`}
            isOn={config.auth.enabled}
            size="xs"
            handleToggle={(e) => {
              setValue(`configs.${type}.auth.enabled`, e.target.checked);
            }}
          />
        </div>

        {config.auth.enabled && (
          <div className="space-y-3 pl-6">
            <div className="grid grid-cols-2 gap-3">
              {/* Username Field */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <IconUser size={14} strokeWidth={1.5} className="text-gray-400" />
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Username
                  </label>
                </div>
                <input
                  type="text"
                  name={`configs.${type}.auth.username`}
                  className={`block w-full textbox ${errors.auth?.username ? 'border-red-300 focus:border-red-500' : ''}`}
                  value={config.auth.username}
                  onChange={handleChange}
                  placeholder="Username"
                />
                {errors.auth?.username && (
                  <div className="flex items-center gap-1 text-red-500 text-xs">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    {errors.auth.username}
                  </div>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <IconKey size={14} strokeWidth={1.5} className="text-gray-400" />
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={passwordVisible ? 'text' : 'password'}
                    name={`configs.${type}.auth.password`}
                    className={`block w-full textbox pr-8 ${errors.auth?.password ? 'border-red-300 focus:border-red-500' : ''}`}
                    value={config.auth.password}
                    onChange={handleChange}
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    onClick={togglePasswordVisibility}
                  >
                    {passwordVisible ? (
                      <IconEyeOff size={16} strokeWidth={1.5} />
                    ) : (
                      <IconEye size={16} strokeWidth={1.5} />
                    )}
                  </button>
                </div>
                {errors.auth?.password && (
                  <div className="flex items-center gap-1 text-red-500 text-xs">
                    <span className="w-1 h-1 bg-red-500 rounded-full"></span>
                    {errors.auth.password}
                  </div>
                )}
              </div>
            </div>

            {/* Compact Auth Info */}
            {/* <div className={`p-2 rounded-md ${bgColor.replace('/', '/30')}`}>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Credentials will be used for proxy authentication.
              </p>
            </div> */}
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomProxyConfig;