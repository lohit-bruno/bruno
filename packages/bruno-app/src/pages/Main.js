import { useState, useEffect } from 'react';
import { Provider } from 'react-redux';
import { AppProvider } from 'providers/App';
import { ToastProvider } from 'providers/Toaster';
import { HotkeysProvider } from 'providers/Hotkeys';

import ReduxStore from 'providers/ReduxStore';
import ThemeProvider from 'providers/Theme/index';
import ErrorBoundary from './ErrorBoundary';

import { request } from '@usebruno/requests-common';

import { ScriptRuntime } from '@usebruno/js-common';
const scriptRuntime = new ScriptRuntime();

(async () => {
  console.log(typeof scriptRuntime.runJs);
  await scriptRuntime.runJs({ script: `
      const url = "https://testbench-sanity.usebruno.com/api/echo/json";
      const response = await axios.post(url, {
        "hello": "bruno"
      });
      console.log(response);
  ` });
})();

import '../styles/globals.css';
import 'codemirror/lib/codemirror.css';
import 'graphiql/graphiql.min.css';
import 'react-tooltip/dist/react-tooltip.css';
import '@usebruno/graphql-docs/dist/esm/index.css';
import '@fontsource/inter/100.css';
import '@fontsource/inter/200.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import { setupPolyfills } from 'utils/common/setupPolyfills';
import { getEnvVars } from 'utils/collections/index';
setupPolyfills();

window.ipcRenderer = {
  invoke: async (channel, ...args) => { 
    console.log(channel, args, typeof request.makeRequest);
    if (channel === 'send-http-request') {
      const [ item, collection, environment, rest ] = args;
      const envVariables = getEnvVars(environment);
      const _res = await request.makeRequest({
        item,
        collection,
        envVariables 
      });
      console.log({_res});
      return res;
    }
    return {} 
  },
  on: (channel, handler) => {
    // Deliberately strip event as it includes `sender`
    const subscription = (event, ...args) => handler(...args);
    // ipcRenderer.on(channel, subscription);

    return () => {
      // ipcRenderer.removeListener(channel, subscription);
    };
  },
  getFilePath (file) {
    // const path = webUtils.getPathForFile(file)
    // return path;
    return 'path';
  }
};

function Main({ children }) {
  if (!window.ipcRenderer) {
    return (
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 mx-10 my-10 rounded relative" role="alert">
        <strong class="font-bold">ERROR:</strong>
        <span className="block inline ml-1">"ipcRenderer" not found in window object.</span>
        <div>
          You most likely opened Bruno inside your web browser. Bruno only works within Electron, you can start Electron
          in an adjacent terminal using "npm run dev:electron".
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Provider store={ReduxStore}>
        <ThemeProvider>
          <ToastProvider>
            <AppProvider>
              <HotkeysProvider>
                {children}
              </HotkeysProvider>
            </AppProvider>
          </ToastProvider>
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  );
}

export default Main;



const res = {
  "status": 200,
  "statusText": "OK",
  "headers": {
    "date": "Sat, 12 Jul 2025 14:59:14 GMT",
    "content-type": "text/plain; charset=utf-8",
    "content-length": "4",
    "connection": "keep-alive",
    "x-powered-by": "Express",
    "access-control-allow-origin": "*",
    "etag": "W/\"4-qUqP5cyxm6YcTAhz05Hph5gvu9M\"",
    "x-do-app-origin": "926ac182-3c90-4dd9-ad71-717f024a0eb2",
    "cache-control": "private",
    "x-do-orig-status": "200",
    "cf-cache-status": "DYNAMIC",
    "server": "cloudflare",
    "cf-ray": "95e1673d1b887ec4-MAA",
    "alt-svc": "h3=\":443\"; ma=86400"
  },
  "data": "test",
  "dataBuffer": "dGVzdA==",
  "size": 4,
  "duration": 1065,
  "timeline": [
    {
      "timestamp": "2025-07-12T14:59:13.320Z",
      "type": "separator"
    },
    {
      "timestamp": "2025-07-12T14:59:13.320Z",
      "type": "info",
      "message": "Preparing request to https://testbench-sanity.usebruno.com/api/echo/text"
    },
    {
      "timestamp": "2025-07-12T14:59:13.320Z",
      "type": "info",
      "message": "Current time is 2025-07-12T14:59:13.320Z"
    },
    {
      "timestamp": "2025-07-12T14:59:13.320Z",
      "type": "request",
      "message": "POST https://testbench-sanity.usebruno.com/api/echo/text"
    },
    {
      "timestamp": "2025-07-12T14:59:13.320Z",
      "type": "requestHeader",
      "message": "Accept: application/json, text/plain, */*"
    },
    {
      "timestamp": "2025-07-12T14:59:13.320Z",
      "type": "requestHeader",
      "message": "Content-Type: text/plain"
    },
    {
      "timestamp": "2025-07-12T14:59:13.320Z",
      "type": "requestHeader",
      "message": "User-Agent: bruno-runtime/2.0.0"
    },
    {
      "timestamp": "2025-07-12T14:59:13.320Z",
      "type": "requestHeader",
      "message": "check: again"
    },
    {
      "timestamp": "2025-07-12T14:59:13.320Z",
      "type": "requestHeader",
      "message": "token: {{request_pre_var_token}}"
    },
    {
      "timestamp": "2025-07-12T14:59:13.320Z",
      "type": "requestHeader",
      "message": "collection-header: collection-header-value"
    },
    {
      "timestamp": "2025-07-12T14:59:13.320Z",
      "type": "requestHeader",
      "message": "Cookie: __cf_bm=lI_VP8pxnhGea9CE6JBKLdFAMbG25Wa6KgRi_oigDfY-1752332337-1.0.1.1-UfvLJeVDteMPFo0W._Z4ydEB.yCUYd1l1.1aD5RBPxhA3i2g7eHH2prr66.wGUB5pxyT83F2deLdMvc6S_w0P3.IHz0Jk_uXrPL9bZTxuiE"
    },
    {
      "timestamp": "2025-07-12T14:59:13.320Z",
      "type": "requestData",
      "message": "test"
    },
    {
      "timestamp": "2025-07-12T14:59:13.320Z",
      "type": "info",
      "message": "SSL validation: disabled"
    },
    {
      "timestamp": "2025-07-12T14:59:13.320Z",
      "type": "tls",
      "message": "ALPN: offers h2, http/1.1"
    },
    {
      "timestamp": "2025-07-12T14:59:13.320Z",
      "type": "tls",
      "message": "Using system default CA certificates"
    },
    {
      "timestamp": "2025-07-12T14:59:13.320Z",
      "type": "info",
      "message": "Trying testbench-sanity.usebruno.com:443..."
    },
    {
      "timestamp": "2025-07-12T14:59:13.321Z",
      "type": "info",
      "message": "DNS lookup: testbench-sanity.usebruno.com -> 172.66.0.96"
    },
    {
      "timestamp": "2025-07-12T14:59:13.321Z",
      "type": "info",
      "message": "DNS lookup: testbench-sanity.usebruno.com -> 162.159.140.98"
    },
    {
      "timestamp": "2025-07-12T14:59:13.678Z",
      "type": "info",
      "message": "Connected to testbench-sanity.usebruno.com (162.159.140.98) port 443"
    },
    {
      "timestamp": "2025-07-12T14:59:13.790Z",
      "type": "tls",
      "message": "SSL connection using TLSv1.3 / TLS_AES_128_GCM_SHA256 (TLSv1/SSLv3)"
    },
    {
      "timestamp": "2025-07-12T14:59:13.790Z",
      "type": "tls",
      "message": "ALPN: server accepted None"
    },
    {
      "timestamp": "2025-07-12T14:59:13.790Z",
      "type": "tls",
      "message": "Server certificate:"
    },
    {
      "timestamp": "2025-07-12T14:59:13.790Z",
      "type": "tls",
      "message": " subject: CN=testbench-sanity.usebruno.com"
    },
    {
      "timestamp": "2025-07-12T14:59:13.790Z",
      "type": "tls",
      "message": " start date: May 14 16:25:04 2025 GMT"
    },
    {
      "timestamp": "2025-07-12T14:59:13.790Z",
      "type": "tls",
      "message": " expire date: Aug 12 16:25:03 2025 GMT"
    },
    {
      "timestamp": "2025-07-12T14:59:13.790Z",
      "type": "tls",
      "message": " subjectAltName: DNS:testbench-sanity.usebruno.com"
    },
    {
      "timestamp": "2025-07-12T14:59:13.790Z",
      "type": "tls",
      "message": " issuer: C=US, O=Let's Encrypt, CN=E5"
    },
    {
      "timestamp": "2025-07-12T14:59:13.790Z",
      "type": "tls",
      "message": "SSL certificate verify ok."
    },
    {
      "timestamp": "2025-07-12T14:59:14.385Z",
      "type": "response",
      "message": "HTTP/1.1 200 OK"
    },
    {
      "timestamp": "2025-07-12T14:59:14.385Z",
      "type": "responseHeader",
      "message": "date: Sat, 12 Jul 2025 14:59:14 GMT"
    },
    {
      "timestamp": "2025-07-12T14:59:14.385Z",
      "type": "responseHeader",
      "message": "content-type: text/plain; charset=utf-8"
    },
    {
      "timestamp": "2025-07-12T14:59:14.385Z",
      "type": "responseHeader",
      "message": "content-length: 4"
    },
    {
      "timestamp": "2025-07-12T14:59:14.385Z",
      "type": "responseHeader",
      "message": "connection: keep-alive"
    },
    {
      "timestamp": "2025-07-12T14:59:14.385Z",
      "type": "responseHeader",
      "message": "x-powered-by: Express"
    },
    {
      "timestamp": "2025-07-12T14:59:14.385Z",
      "type": "responseHeader",
      "message": "access-control-allow-origin: *"
    },
    {
      "timestamp": "2025-07-12T14:59:14.385Z",
      "type": "responseHeader",
      "message": "etag: W/\"4-qUqP5cyxm6YcTAhz05Hph5gvu9M\""
    },
    {
      "timestamp": "2025-07-12T14:59:14.385Z",
      "type": "responseHeader",
      "message": "x-do-app-origin: 926ac182-3c90-4dd9-ad71-717f024a0eb2"
    },
    {
      "timestamp": "2025-07-12T14:59:14.385Z",
      "type": "responseHeader",
      "message": "cache-control: private"
    },
    {
      "timestamp": "2025-07-12T14:59:14.385Z",
      "type": "responseHeader",
      "message": "x-do-orig-status: 200"
    },
    {
      "timestamp": "2025-07-12T14:59:14.385Z",
      "type": "responseHeader",
      "message": "cf-cache-status: DYNAMIC"
    },
    {
      "timestamp": "2025-07-12T14:59:14.385Z",
      "type": "responseHeader",
      "message": "server: cloudflare"
    },
    {
      "timestamp": "2025-07-12T14:59:14.385Z",
      "type": "responseHeader",
      "message": "cf-ray: 95e1673d1b887ec4-MAA"
    },
    {
      "timestamp": "2025-07-12T14:59:14.385Z",
      "type": "responseHeader",
      "message": "alt-svc: h3=\":443\"; ma=86400"
    },
    {
      "timestamp": "2025-07-12T14:59:14.385Z",
      "type": "responseHeader",
      "message": "request-duration: 1065"
    },
    {
      "timestamp": "2025-07-12T14:59:14.385Z",
      "type": "info",
      "message": "Request completed in 1065 ms"
    }
  ]
}