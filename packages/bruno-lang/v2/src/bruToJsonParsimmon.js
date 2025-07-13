const P = require('parsimmon');
const _ = require('lodash');
const { safeParseJson, outdentString } = require('./utils');

/**
 * A Bru file is made up of blocks.
 * There are two types of blocks
 *
 * 1. Dictionary Blocks - These are blocks that have key value pairs
 * ex:
 *  headers {
 *   content-type: application/json
 *  }
 *
 * 2. Text Blocks - These are blocks that have text
 * ex:
 * body:json {
 *  {
 *   "username": "John Nash",
 *   "password": "governingdynamics
 *  }
 *
 */

// Helper functions from the original implementation
const mapPairListToKeyValPairs = (pairList = [], parseEnabled = true) => {
  if (!pairList.length) {
    return [];
  }
  return _.map(pairList, (pair) => {
    let name = _.keys(pair)[0];
    let value = pair[name];

    if (!parseEnabled) {
      return {
        name,
        value
      };
    }

    let enabled = true;
    if (name && name.length && name.charAt(0) === '~') {
      name = name.slice(1);
      enabled = false;
    }

    return {
      name,
      value,
      enabled
    };
  });
};

const mapRequestParams = (pairList = [], type) => {
  if (!pairList.length) {
    return [];
  }
  return _.map(pairList, (pair) => {
    let name = _.keys(pair)[0];
    let value = pair[name];
    let enabled = true;
    if (name && name.length && name.charAt(0) === '~') {
      name = name.slice(1);
      enabled = false;
    }

    return {
      name,
      value,
      enabled,
      type
    };
  });
};

const multipartExtractContentType = (pair) => {
  if (_.isString(pair.value)) {
    const match = pair.value.match(/^(.*?)\s*@contentType\((.*?)\)\s*$/);
    if (match != null && match.length > 2) {
      pair.value = match[1];
      pair.contentType = match[2];
    } else {
      pair.contentType = '';
    }
  }
};

const fileExtractContentType = (pair) => {
  if (_.isString(pair.value)) {
    const match = pair.value.match(/^(.*?)\s*@contentType\((.*?)\)\s*$/);
    if (match && match.length > 2) {
      pair.value = match[1].trim();
      pair.contentType = match[2].trim();
    } else {
      pair.contentType = '';
    }
  }
};

const mapPairListToKeyValPairsMultipart = (pairList = [], parseEnabled = true) => {
  const pairs = mapPairListToKeyValPairs(pairList, parseEnabled);

  return pairs.map((pair) => {
    pair.type = 'text';
    multipartExtractContentType(pair);

    if (pair.value.startsWith('@file(') && pair.value.endsWith(')')) {
      let filestr = pair.value.replace(/^@file\(/, '').replace(/\)$/, '');
      pair.type = 'file';
      pair.value = filestr.split('|');
    }

    return pair;
  });
};

const mapPairListToKeyValPairsFile = (pairList = [], parseEnabled = true) => {
  const pairs = mapPairListToKeyValPairs(pairList, parseEnabled);
  return pairs.map((pair) => {
    fileExtractContentType(pair);

    if (pair.value.startsWith('@file(') && pair.value.endsWith(')')) {
      let filePath = pair.value.replace(/^@file\(/, '').replace(/\)$/, '');      
      pair.filePath = filePath;
      pair.selected = pair.enabled
      
      // Remove pair.value as it only contains the file path reference
      delete pair.value;
      // Remove pair.name as it is auto-generated (e.g., file1, file2, file3, etc.)
      delete pair.name;
      delete pair.enabled;
    }

    return pair;
  });
};

const mapPairListToKeyValPair = (pairList = []) => {
  if (!pairList || !pairList.length) {
    return {};
  }
  return _.merge({}, ...pairList);
};

const concatArrays = (objValue, srcValue) => {
  if (_.isArray(objValue) && _.isArray(srcValue)) {
    return objValue.concat(srcValue);
  }
};

// Basic parsers
const ws = P.regexp(/[ \t]*/);
const nl = P.regexp(/\r?\n/);
const eof = P.eof;

// Key-value pair parsers
const key = P.regexp(/[^:\r\n]+/).map(k => k.trim());
const multilinetextblock = P.seq(
  P.string("'''"),
  P.regexp(/[\s\S]*?(?=''')/),
  P.string("'''")
).map(([, content]) => {
  return content
    .split('\n')
    .map((line) => line.slice(4))
    .join('\n');
});

const regularValue = P.regexp(/[^\r\n]*/);
const value = P.alt(multilinetextblock, regularValue).map(v => v.trim());

// Key-value pair
const pair = P.seq(
  ws,
  key,
  ws,
  P.string(':'),
  ws,
  value,
  ws,
  P.alt(nl, eof)
).map(([, k, , , , v]) => {
  const result = {};
  result[k] = v;
  return result;
});

// Dictionary block
const dictionary = P.seq(
  ws,
  P.string('{'),
  ws,
  nl,
  pair.many(),
  ws,
  P.string('}')
).map(([, , , , pairs]) => pairs);

// Text block
const textContent = P.seq(
  P.lookahead(P.regexp(/[^}]/)),
  P.regexp(/[\s\S]*?(?=\n})/),
).map(([, content]) => content);

const textBlock = P.seq(
  ws,
  P.string('{'),
  ws,
  nl,
  textContent,
  nl,
  ws,
  P.string('}')
).map(([, , , , content]) => content);

// Block parsers
const meta = P.seq(P.string('meta'), dictionary).map(([, dict]) => {
  let meta = mapPairListToKeyValPair(dict);
  
  if (!meta.seq) {
    meta.seq = 1;
  }
  
  if (!meta.type) {
    meta.type = 'http';
  }
  
  return { meta };
});

const httpMethod = (method) => P.seq(P.string(method), dictionary).map(([, dict]) => ({
  http: {
    method,
    ...mapPairListToKeyValPair(dict)
  }
}));

const get = httpMethod('get');
const post = httpMethod('post');
const put = httpMethod('put');
const del = httpMethod('delete');
const patch = httpMethod('patch');
const options = httpMethod('options');
const head = httpMethod('head');
const connect = httpMethod('connect');
const trace = httpMethod('trace');

const http = P.alt(get, post, put, del, patch, options, head, connect, trace);

const headers = P.seq(P.string('headers'), dictionary).map(([, dict]) => ({
  headers: mapPairListToKeyValPairs(dict)
}));

const query = P.seq(P.string('query'), dictionary).map(([, dict]) => ({
  params: mapRequestParams(dict, 'query')
}));

const paramspath = P.seq(P.string('params:path'), dictionary).map(([, dict]) => ({
  params: mapRequestParams(dict, 'path')
}));

const paramsquery = P.seq(P.string('params:query'), dictionary).map(([, dict]) => ({
  params: mapRequestParams(dict, 'query')
}));

const params = P.alt(paramspath, paramsquery);

// Auth parsers
const authawsv4 = P.seq(P.string('auth:awsv4'), dictionary).map(([, dict]) => {
  const auth = mapPairListToKeyValPairs(dict, false);
  const findValue = (name) => {
    const item = _.find(auth, { name });
    return item ? item.value : '';
  };
  
  return {
    auth: {
      awsv4: {
        accessKeyId: findValue('accessKeyId'),
        secretAccessKey: findValue('secretAccessKey'),
        sessionToken: findValue('sessionToken'),
        service: findValue('service'),
        region: findValue('region'),
        profileName: findValue('profileName')
      }
    }
  };
});

const authbasic = P.seq(P.string('auth:basic'), dictionary).map(([, dict]) => {
  const auth = mapPairListToKeyValPairs(dict, false);
  const findValue = (name) => {
    const item = _.find(auth, { name });
    return item ? item.value : '';
  };
  
  return {
    auth: {
      basic: {
        username: findValue('username'),
        password: findValue('password')
      }
    }
  };
});

const authbearer = P.seq(P.string('auth:bearer'), dictionary).map(([, dict]) => {
  const auth = mapPairListToKeyValPairs(dict, false);
  const findValue = (name) => {
    const item = _.find(auth, { name });
    return item ? item.value : '';
  };
  
  return {
    auth: {
      bearer: {
        token: findValue('token')
      }
    }
  };
});

const authdigest = P.seq(P.string('auth:digest'), dictionary).map(([, dict]) => {
  const auth = mapPairListToKeyValPairs(dict, false);
  const findValue = (name) => {
    const item = _.find(auth, { name });
    return item ? item.value : '';
  };
  
  return {
    auth: {
      digest: {
        username: findValue('username'),
        password: findValue('password')
      }
    }
  };
});

const authntlm = P.seq(P.string('auth:ntlm'), dictionary).map(([, dict]) => {
  const auth = mapPairListToKeyValPairs(dict, false);
  const findValue = (name) => {
    const item = _.find(auth, { name });
    return item ? item.value : '';
  };
  
  return {
    auth: {
      ntlm: {
        username: findValue('username'),
        password: findValue('password'),
        domain: findValue('domain')
      }
    }
  };
});

const authwsse = P.seq(P.string('auth:wsse'), dictionary).map(([, dict]) => {
  const auth = mapPairListToKeyValPairs(dict, false);
  const findValue = (name) => {
    const item = _.find(auth, { name });
    return item ? item.value : '';
  };
  
  return {
    auth: {
      wsse: {
        username: findValue('username'),
        password: findValue('password')
      }
    }
  };
});

const authapikey = P.seq(P.string('auth:apikey'), dictionary).map(([, dict]) => {
  const auth = mapPairListToKeyValPairs(dict, false);
  const findValue = (name) => {
    const item = _.find(auth, { name });
    return item ? item.value : '';
  };
  
  return {
    auth: {
      apikey: {
        key: findValue('key'),
        value: findValue('value'),
        placement: findValue('placement')
      }
    }
  };
});

const authOAuth2 = P.seq(P.string('auth:oauth2'), dictionary).map(([, dict]) => {
  const auth = mapPairListToKeyValPairs(dict, false);
  const findValue = (name) => {
    const item = _.find(auth, { name });
    return item ? item.value : '';
  };
  
  const grantType = findValue('grant_type');
  const baseOAuth2 = {
    grantType,
    clientId: findValue('client_id'),
    clientSecret: findValue('client_secret'),
    scope: findValue('scope'),
    credentialsPlacement: findValue('credentials_placement') || 'body',
    credentialsId: findValue('credentials_id') || 'credentials',
    tokenPlacement: findValue('token_placement') || 'header',
    tokenHeaderPrefix: findValue('token_header_prefix') || '',
    tokenQueryKey: findValue('token_query_key') || 'access_token',
    autoFetchToken: safeParseJson(findValue('auto_fetch_token')) ?? true,
    autoRefreshToken: safeParseJson(findValue('auto_refresh_token')) ?? false
  };
  
  let oauth2Config = { ...baseOAuth2 };
  
  if (grantType === 'password') {
    oauth2Config = {
      ...oauth2Config,
      accessTokenUrl: findValue('access_token_url'),
      refreshTokenUrl: findValue('refresh_token_url'),
      username: findValue('username'),
      password: findValue('password')
    };
  } else if (grantType === 'authorization_code') {
    oauth2Config = {
      ...oauth2Config,
      callbackUrl: findValue('callback_url'),
      authorizationUrl: findValue('authorization_url'),
      accessTokenUrl: findValue('access_token_url'),
      refreshTokenUrl: findValue('refresh_token_url'),
      state: findValue('state'),
      pkce: safeParseJson(findValue('pkce')) ?? false
    };
  } else if (grantType === 'client_credentials') {
    oauth2Config = {
      ...oauth2Config,
      accessTokenUrl: findValue('access_token_url'),
      refreshTokenUrl: findValue('refresh_token_url')
    };
  } else if (grantType === 'implicit') {
    oauth2Config = {
      ...oauth2Config,
      callbackUrl: findValue('callback_url'),
      authorizationUrl: findValue('authorization_url'),
      state: findValue('state')
    };
    // Remove fields not used in implicit flow
    delete oauth2Config.autoRefreshToken;
  }
  
  return {
    auth: {
      oauth2: oauth2Config
    }
  };
});

const auths = P.alt(authawsv4, authbasic, authbearer, authdigest, authntlm, authOAuth2, authwsse, authapikey);

// Body parsers
const bodyTextBlockParser = (bodyType) => P.seq(
  P.string(`body:${bodyType}`),
  textBlock
).map(([, text]) => {
  const result = { body: {} };
  result.body[bodyType] = outdentString(text);
  return result;
});

const body = P.seq(P.string('body'), textBlock).map(([, text]) => ({
  http: { body: 'json' },
  body: { json: outdentString(text) }
}));

const bodyjson = bodyTextBlockParser('json');
const bodytext = bodyTextBlockParser('text');
const bodyxml = bodyTextBlockParser('xml');
const bodysparql = bodyTextBlockParser('sparql');

const bodygraphql = P.seq(P.string('body:graphql'), textBlock).map(([, text]) => ({
  body: {
    graphql: {
      query: outdentString(text)
    }
  }
}));

const bodygraphqlvars = P.seq(P.string('body:graphql:vars'), textBlock).map(([, text]) => ({
  body: {
    graphql: {
      variables: outdentString(text)
    }
  }
}));

const bodyformurlencoded = P.seq(P.string('body:form-urlencoded'), dictionary).map(([, dict]) => ({
  body: {
    formUrlEncoded: mapPairListToKeyValPairs(dict)
  }
}));

const bodymultipart = P.seq(P.string('body:multipart-form'), dictionary).map(([, dict]) => ({
  body: {
    multipartForm: mapPairListToKeyValPairsMultipart(dict)
  }
}));

const bodyfile = P.seq(P.string('body:file'), dictionary).map(([, dict]) => ({
  body: {
    file: mapPairListToKeyValPairsFile(dict)
  }
}));

const bodies = P.alt(bodyjson, bodytext, bodyxml, bodysparql, bodygraphql, bodygraphqlvars, bodyformurlencoded, bodymultipart, bodyfile, body);

// Variables parsers
const varsreq = P.seq(P.string('vars:pre-request'), dictionary).map(([, dict]) => {
  const vars = mapPairListToKeyValPairs(dict);
  _.each(vars, (v) => {
    let name = v.name;
    if (name && name.length && name.charAt(0) === '@') {
      v.name = name.slice(1);
      v.local = true;
    } else {
      v.local = false;
    }
  });
  
  return {
    vars: {
      req: vars
    }
  };
});

const varsres = P.seq(P.string('vars:post-response'), dictionary).map(([, dict]) => {
  const vars = mapPairListToKeyValPairs(dict);
  _.each(vars, (v) => {
    let name = v.name;
    if (name && name.length && name.charAt(0) === '@') {
      v.name = name.slice(1);
      v.local = true;
    } else {
      v.local = false;
    }
  });
  
  return {
    vars: {
      res: vars
    }
  };
});

const varsandassert = P.alt(varsreq, varsres);

// Assert parser
const assert = P.seq(P.string('assert'), dictionary).map(([, dict]) => ({
  assertions: mapPairListToKeyValPairs(dict)
}));

// Script parsers
const scriptreq = P.seq(P.string('script:pre-request'), textBlock).map(([, text]) => ({
  script: {
    req: outdentString(text)
  }
}));

const scriptres = P.seq(P.string('script:post-response'), textBlock).map(([, text]) => ({
  script: {
    res: outdentString(text)
  }
}));

const script = P.alt(scriptreq, scriptres);

// Tests parser
const tests = P.seq(P.string('tests'), textBlock).map(([, text]) => ({
  tests: outdentString(text)
}));

// Docs parser
const docs = P.seq(P.string('docs'), textBlock).map(([, text]) => ({
  docs: outdentString(text)
}));

// Main parser
const block = P.alt(
  meta,
  http,
  query,
  params,
  headers,
  auths,
  bodies,
  varsandassert,
  assert,
  script,
  tests,
  docs
);

const bruFile = P.seq(
  P.regexp(/\s*/),
  block.sepBy(P.regexp(/\s+/)),
  P.regexp(/\s*/)
).map(([, blocks]) => {
  if (!blocks || !blocks.length) {
    return {};
  }
  
  return _.reduce(
    blocks,
    (result, item) => {
      return _.mergeWith(result, item, concatArrays);
    },
    {}
  );
});

const parser = (input) => {
  const result = bruFile.parse(input);
  if (result.status) {
    return result.value;
  } else {
    throw new Error(result.expected.join(', '));
  }
};

module.exports = parser;
      