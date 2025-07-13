import { AxiosResponse } from 'axios';

export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, any>;
  data: any;
  responseTime?: number;
  size?: number;
}

/**
 * Parse response data based on content type and response format
 */
export const parseResponseData = (response: AxiosResponse, disableJsonParsing = false): { data: any; dataBuffer: string } => {
  let data = response.data;
  let dataBuffer = '';

  try {
    if (response.data instanceof ArrayBuffer) {
      // Convert ArrayBuffer to Uint8Array then to base64
      const uint8Array = new Uint8Array(response.data);
      dataBuffer = btoa(String.fromCharCode(...uint8Array));
      
      // Try to parse as text if it looks like text content
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text') || contentType.includes('json') || contentType.includes('xml')) {
        try {
          const textData = new TextDecoder().decode(response.data);
          data = textData;
          
          // Parse JSON if content type suggests it and parsing is enabled
          if (!disableJsonParsing && contentType.includes('json')) {
            try {
              data = JSON.parse(textData);
            } catch {
              // Keep as text if JSON parsing fails
              data = textData;
            }
          }
        } catch {
          // Keep as buffer if text decoding fails
          data = dataBuffer;
        }
      } else {
        data = dataBuffer;
      }
    } else if (typeof response.data === 'string') {
      data = response.data;
      dataBuffer = btoa(response.data);
      
      // Try to parse JSON if it looks like JSON and parsing is enabled
      if (!disableJsonParsing) {
        const trimmed = response.data.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            data = JSON.parse(response.data);
          } catch {
            // Keep as string if JSON parsing fails
          }
        }
      }
    } else if (typeof response.data === 'object') {
      // Already parsed object
      data = response.data;
      const jsonString = JSON.stringify(response.data);
      dataBuffer = btoa(jsonString);
    } else {
      // Other data types
      const stringData = String(response.data);
      data = stringData;
      dataBuffer = btoa(stringData);
    }
  } catch (error) {
    console.warn('Error parsing response data:', error);
    // Fallback to original data
    data = response.data;
    try {
      dataBuffer = btoa(String(response.data));
    } catch {
      dataBuffer = '';
    }
  }

  return { data, dataBuffer };
};

/**
 * Calculate response size in bytes
 */
export const calculateResponseSize = (dataBuffer: string): number => {
  try {
    // Base64 string length * 3/4 gives approximate byte size
    return Math.floor(dataBuffer.length * 3 / 4);
  } catch {
    return 0;
  }
};

/**
 * Extract response metadata
 */
export const extractResponseMetadata = (response: AxiosResponse): {
  status: number;
  statusText: string;
  headers: Record<string, any>;
  responseTime?: number;
} => {
  return {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers || {},
    responseTime: (response as any).responseTime
  };
};

/**
 * Create a standardized response object for script execution
 */
export const createResponseObject = (response: AxiosResponse, disableJsonParsing = false): ResponseData => {
  const { data, dataBuffer } = parseResponseData(response, disableJsonParsing);
  const metadata = extractResponseMetadata(response);
  const size = calculateResponseSize(dataBuffer);

  return {
    ...metadata,
    data,
    size
  };
};

/**
 * Process response for variable extraction and script execution
 */
export const processResponse = (
  response: AxiosResponse,
  request: any,
  options: {
    disableJsonParsing?: boolean;
    extractVariables?: boolean;
  } = {}
): {
  processedResponse: ResponseData;
  dataBuffer: string;
  size: number;
} => {
  const { disableJsonParsing = false } = options;
  
  const { data, dataBuffer } = parseResponseData(response, disableJsonParsing);
  const size = calculateResponseSize(dataBuffer);
  
  // Update the original response object
  response.data = data;
  
  const processedResponse = createResponseObject(response, disableJsonParsing);
  
  return {
    processedResponse,
    dataBuffer,
    size
  };
};

/**
 * Check if response indicates an error state
 */
export const isErrorResponse = (response: AxiosResponse): boolean => {
  return response.status >= 400;
};

/**
 * Extract error information from response
 */
export const extractErrorInfo = (response: AxiosResponse): {
  isError: boolean;
  errorType?: string;
  errorMessage?: string;
} => {
  const isError = isErrorResponse(response);
  
  if (!isError) {
    return { isError: false };
  }
  
  let errorType = 'HTTP Error';
  let errorMessage = `${response.status} ${response.statusText}`;
  
  if (response.status >= 500) {
    errorType = 'Server Error';
  } else if (response.status >= 400) {
    errorType = 'Client Error';
  }
  
  // Try to extract more detailed error from response body
  try {
    if (response.data && typeof response.data === 'object') {
      if (response.data.error) {
        errorMessage = response.data.error;
      } else if (response.data.message) {
        errorMessage = response.data.message;
      }
    } else if (typeof response.data === 'string') {
      errorMessage = response.data;
    }
  } catch {
    // Keep the default error message
  }
  
  return {
    isError: true,
    errorType,
    errorMessage
  };
};

/**
 * Format response for display/logging
 */
export const formatResponse = (response: ResponseData): string => {
  const lines = [
    `Status: ${response.status} ${response.statusText}`,
    `Headers: ${JSON.stringify(response.headers, null, 2)}`,
  ];
  
  if (response.responseTime !== undefined) {
    lines.push(`Response Time: ${response.responseTime}ms`);
  }
  
  if (response.size !== undefined) {
    lines.push(`Size: ${response.size} bytes`);
  }
  
  if (response.data !== undefined) {
    lines.push(`Data: ${typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : String(response.data)}`);
  }
  
  return lines.join('\n');
}; 