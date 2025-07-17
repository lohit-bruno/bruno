import React from 'react';
import { savePreferences } from 'providers/ReduxStore/slices/app';

import StyledWrapper from './StyledWrapper';
import { useDispatch, useSelector } from 'react-redux';
import CustomProxy from './CustomProxy/index';
import SystemProxy from './SystemProxy/index';
// import { IconEye, IconEyeOff } from '@tabler/icons';
// import ToggleSwitch from 'components/ToggleSwitch/index';

const ProxySettings = ({ close }) => {
  const dispatch = useDispatch();
  const preferences = useSelector((state) => state.app.preferences);
  const proxyPreferences = preferences.proxy;
  const proxyMode = proxyPreferences.mode;

  const handleChange = e => {
    dispatch(
      savePreferences({
        ...preferences,
        proxy: {
          ...proxyPreferences,
          mode: e.target.value
        }
      })
    );
  }

  return (
    <StyledWrapper>
      <div className="mb-3 flex items-center mt-2">
        <label className="settings-label font-semibold">
          Proxy Mode
        </label>
        <div className="flex items-center">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="off"
              checked={proxyMode === 'off'}
              onChange={handleChange}
              className="mr-1 cursor-pointer"
            />
            Off
          </label>
          <label className="flex items-center ml-4 cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="on"
              checked={proxyMode === 'on'}
              onChange={handleChange}
              className="mr-1 cursor-pointer"
            />
            On
          </label>
          <label className="flex items-center ml-4 cursor-pointer">
            <input
              type="radio"
              name="mode"
              value="system"
              checked={proxyMode === 'system'}
              onChange={handleChange}
              className="mr-1 cursor-pointer"
            />
            System Proxy
          </label>
        </div>
      </div>
      {proxyMode == 'on' ? 
          <CustomProxy /> :
        proxyMode == 'system' ?
          <SystemProxy /> : null}
    </StyledWrapper>
  );
};

export default ProxySettings;
