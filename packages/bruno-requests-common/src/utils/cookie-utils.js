const isLoopbackV4 = (address) => {
  // 127.0.0.0/8: first octet = 127
  const octets = address.split('.');
  return (
    octets.length === 4
  ) && parseInt(octets[0], 10) === 127;
}

const isLoopbackV6 = (address) => {
  // new URL(...) follows the WHATWG URL Standard
  // which compresses IPv6 addresses, therefore the IPv6
  // loopback address will always be compressed to '[::1]':
  // https://url.spec.whatwg.org/#concept-ipv6-serializer
  return (address === '::1');
}

// Browser-compatible IP validation
const isIPv4 = (address) => {
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(address);
}

const isIPv6 = (address) => {
  // Simplified IPv6 validation for browser compatibility
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
  return ipv6Regex.test(address);
}

const isIpLoopback = (address) => {
  if (isIPv4(address)) {
    return isLoopbackV4(address);
  }

  if (isIPv6(address)) {
    return isLoopbackV6(address);
  }

  return false;
}

const isNormalizedLocalhostTLD = (host) => {
  return host.toLowerCase().endsWith('.localhost');
}

const isLocalHostname = (host) => {
  return host.toLowerCase() === 'localhost' ||
    isNormalizedLocalhostTLD(host);
}

/**
 * Removes leading and trailing square brackets if present.
 * Adapted from https://github.com/chromium/chromium/blob/main/url/gurl.cc#L440-L448
 *
 * @param {string} host
 * @returns {string}
 */
const hostNoBrackets = (host) => {
  if (host.length >= 2 && host.startsWith('[') && host.endsWith(']')) {
    return host.substring(1, host.length - 1);
  }
  return host;
}

/**
 * Determines if a URL string represents a potentially trustworthy origin.
 * 
 * A URL is considered potentially trustworthy if it:
 * - Uses HTTPS, WSS or file schemes
 * - Points to a loopback address (IPv4 127.0.0.0/8 or IPv6 ::1)
 * - Uses localhost or *.localhost hostnames
 * 
 * @param {string} urlString - The URL to check
 * @returns {boolean}
 * @see {@link https://w3c.github.io/webappsec-secure-contexts/#potentially-trustworthy-origin W3C Spec}
 */
const isPotentiallyTrustworthyOrigin = (urlString) => {
  let url;

  // try ... catch doubles as an opaque origin check
  try {
    url = new URL(urlString);
  } catch (e) {
    if (e instanceof TypeError) {
      return false;
    } else throw e;
  }

  const scheme = url.protocol.replace(':', '').toLowerCase();
  const hostname = hostNoBrackets(
    url.hostname
  ).replace(/\.+$/, '');

  if (
    scheme === 'https' ||
    scheme === 'wss' ||
    scheme === 'file' // https://w3c.github.io/webappsec-secure-contexts/#potentially-trustworthy-origin
  ) {
    return true;
  }

  // If it's already an IP literal, check if it's a loopback address
  if (isIPv4(hostname) || isIPv6(hostname)) {
    return isIpLoopback(hostname);
  }

  // RFC 6761 states that localhost names will always resolve
  // to the respective IP loopback address:
  // https://datatracker.ietf.org/doc/html/rfc6761#section-6.3
  return isLocalHostname(hostname);
}

export {
  isPotentiallyTrustworthyOrigin
};