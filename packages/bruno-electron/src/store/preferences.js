const Yup = require('yup');
const Store = require('electron-store');
const { get, merge } = require('lodash');

/**
 * The preferences are stored in the electron store 'preferences.json'.
 * The electron process uses this module to get the preferences.
 *
 */

const defaultPreferences = {
  request: {
    sslVerification: true,
    customCaCertificate: {
      enabled: false,
      filePath: null
    },
    keepDefaultCaCertificates: {
      enabled: true
    },
    storeCookies: true,
    sendCookies: true,
    timeout: 0
  },
  font: {
    codeFont: 'default',
    codeFontSize: 14
  },
  proxy: {
    mode: 'off',
    protocol: 'http',
    hostname: '',
    port: null,
    auth: {
      enabled: false,
      username: '',
      password: ''
    },
    bypassProxy: '',
    // New multi-proxy configuration
    configs: {
      http: {
        enabled: false,
        hostname: '',
        port: null,
        auth: {
          enabled: false,
          username: '',
          password: ''
        }
      },
      https: {
        enabled: false,
        hostname: '',
        port: null,
        auth: {
          enabled: false,
          username: '',
          password: ''
        }
      },
      socks: {
        enabled: false,
        protocol: 'socks5',
        hostname: '',
        port: null,
        auth: {
          enabled: false,
          username: '',
          password: ''
        }
      }
    }
  },
  layout: {
    responsePaneOrientation: 'horizontal'
  }
};

const preferencesSchema = Yup.object().shape({
  request: Yup.object().shape({
    sslVerification: Yup.boolean(),
    customCaCertificate: Yup.object({
      enabled: Yup.boolean(),
      filePath: Yup.string().nullable()
    }),
    keepDefaultCaCertificates: Yup.object({
      enabled: Yup.boolean()
    }),
    storeCookies: Yup.boolean(),
    sendCookies: Yup.boolean(),
    timeout: Yup.number()
  }),
  font: Yup.object().shape({
    codeFont: Yup.string().nullable(),
    codeFontSize: Yup.number().min(1).max(32).nullable()
  }),
  proxy: Yup.object({
    mode: Yup.string().oneOf(['off', 'on', 'system']),
    // Legacy fields for backward compatibility
    protocol: Yup.string().oneOf(['http', 'https', 'socks4', 'socks5']),
    hostname: Yup.string().max(1024),
    port: Yup.number().min(1).max(65535).nullable(),
    auth: Yup.object({
      enabled: Yup.boolean(),
      username: Yup.string().max(1024),
      password: Yup.string().max(1024)
    }).optional(),
    bypassProxy: Yup.string().optional().max(1024),
    // New multi-proxy configuration schema
    configs: Yup.object({
      http: Yup.object({
        enabled: Yup.boolean(),
        hostname: Yup.string().max(1024),
        port: Yup.number().min(1).max(65535).nullable(),
        auth: Yup.object({
          enabled: Yup.boolean(),
          username: Yup.string().max(1024),
          password: Yup.string().max(1024)
        }).optional()
      }).optional(),
      https: Yup.object({
        enabled: Yup.boolean(),
        hostname: Yup.string().max(1024),
        port: Yup.number().min(1).max(65535).nullable(),
        auth: Yup.object({
          enabled: Yup.boolean(),
          username: Yup.string().max(1024),
          password: Yup.string().max(1024)
        }).optional()
      }).optional(),
      socks: Yup.object({
        enabled: Yup.boolean(),
        protocol: Yup.string().oneOf(['socks4', 'socks5']),
        hostname: Yup.string().max(1024),
        port: Yup.number().min(1).max(65535).nullable(),
        auth: Yup.object({
          enabled: Yup.boolean(),
          username: Yup.string().max(1024),
          password: Yup.string().max(1024)
        }).optional()
      }).optional()
    }).optional()
  }),
  layout: Yup.object({
    responsePaneOrientation: Yup.string().oneOf(['horizontal', 'vertical'])
  })
});

class PreferencesStore {
  constructor() {
    this.store = new Store({
      name: 'preferences',
      clearInvalidConfig: true
    });
  }

  getPreferences() {
    let preferences = this.store.get('preferences', {});

    // This to support the old preferences format
    // In the old format, we had a proxy.enabled flag
    // In the new format, this maps to proxy.mode = 'on'
    if (preferences?.proxy?.enabled) {
      preferences.proxy.mode = 'on';
    }

    // Delete the proxy.enabled property if it exists, regardless of its value
    // This is a part of migration to the new preferences format
    if (preferences?.proxy && 'enabled' in preferences.proxy) {
      delete preferences.proxy.enabled;
    }

    // Migration: Convert old single-proxy config to multi-proxy format
    if (preferences?.proxy && !preferences?.proxy?.configs) {
      const oldProxy = preferences.proxy;
      if (oldProxy.hostname || oldProxy.port) {
        preferences.proxy.configs = {
          http: { enabled: false, hostname: '', port: null, auth: { enabled: false, username: '', password: '' } },
          https: { enabled: false, hostname: '', port: null, auth: { enabled: false, username: '', password: '' } },
          socks: { enabled: false, protocol: 'socks5', hostname: '', port: null, auth: { enabled: false, username: '', password: '' } }
        };

        // Migrate based on the old protocol setting
        if (oldProxy.protocol === 'http') {
          preferences.proxy.configs.http = {
            enabled: true,
            hostname: oldProxy.hostname || '',
            port: oldProxy.port || null,
            auth: {
              enabled: oldProxy.auth?.enabled || false,
              username: oldProxy.auth?.username || '',
              password: oldProxy.auth?.password || ''
            }
          };
        } else if (oldProxy.protocol === 'https') {
          preferences.proxy.configs.https = {
            enabled: true,
            hostname: oldProxy.hostname || '',
            port: oldProxy.port || null,
            auth: {
              enabled: oldProxy.auth?.enabled || false,
              username: oldProxy.auth?.username || '',
              password: oldProxy.auth?.password || ''
            }
          };
        } else if (oldProxy.protocol === 'socks4' || oldProxy.protocol === 'socks5') {
          preferences.proxy.configs.socks = {
            enabled: true,
            protocol: oldProxy.protocol,
            hostname: oldProxy.hostname || '',
            port: oldProxy.port || null,
            auth: {
              enabled: oldProxy.auth?.enabled || false,
              username: oldProxy.auth?.username || '',
              password: oldProxy.auth?.password || ''
            }
          };
        }
      }
    }

    return merge({}, defaultPreferences, preferences);
  }

  savePreferences(newPreferences) {
    return this.store.set('preferences', newPreferences);
  }
}

const preferencesStore = new PreferencesStore();

const getPreferences = () => {
  return preferencesStore.getPreferences();
};

const savePreferences = async (newPreferences) => {
  return new Promise((resolve, reject) => {
    preferencesSchema
      .validate(newPreferences, { abortEarly: true })
      .then((validatedPreferences) => {
        preferencesStore.savePreferences(validatedPreferences);
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
  });
};

const preferencesUtil = {
  shouldVerifyTls: () => {
    return get(getPreferences(), 'request.sslVerification', true);
  },
  shouldUseCustomCaCertificate: () => {
    return get(getPreferences(), 'request.customCaCertificate.enabled', false);
  },
  shouldKeepDefaultCaCertificates: () => {
    return get(getPreferences(), 'request.keepDefaultCaCertificates.enabled', true);
  },
  getCustomCaCertificateFilePath: () => {
    return get(getPreferences(), 'request.customCaCertificate.filePath', null);
  },
  getRequestTimeout: () => {
    return get(getPreferences(), 'request.timeout', 0);
  },
  getGlobalProxyConfig: () => {
    return get(getPreferences(), 'proxy', {});
  },
  shouldStoreCookies: () => {
    return get(getPreferences(), 'request.storeCookies', true);
  },
  shouldSendCookies: () => {
    return get(getPreferences(), 'request.sendCookies', true);
  },
  getResponsePaneOrientation: () => {
    return get(getPreferences(), 'layout.responsePaneOrientation', 'horizontal');
  }
};

module.exports = {
  getPreferences,
  savePreferences,
  preferencesUtil
};
