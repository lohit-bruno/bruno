import { AxiosRequestConfig } from 'axios';
import { makeAxiosInstance } from '../network';
import { T_CertsAndProxyConfigResult } from '../network/types';

type T_SendRequestCallback = (error: any, response: any) => void;

const createSendRequestHandler = ({ certsAndProxyConfig }: { certsAndProxyConfig: T_CertsAndProxyConfigResult }) => {
  return async (requestConfig: AxiosRequestConfig, callback: T_SendRequestCallback) => {
    const axiosInstance = makeAxiosInstance({ logId: 'send-request', certsAndProxyConfig });
    if (!callback) {
      return await axiosInstance(requestConfig);
    }
    try {
      const response = await axiosInstance(requestConfig);
      try {
        await callback(null, response);
      }
      catch(error) {
        return Promise.reject(error);
      }
    }
    catch (error) {
      try {
        await callback(error, null);
      }
      catch(err) {
        return Promise.reject(err);
      }
    }
  }
}

export default createSendRequestHandler;
