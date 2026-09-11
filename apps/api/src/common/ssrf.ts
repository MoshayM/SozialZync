/**
 * SSRF (Server-Side Request Forgery) protection utilities — OWASP A10:2021.
 *
 * Call `validateOutboundUrl` before making ANY external HTTP request to a
 * user-supplied or user-influenced URL. It resolves the hostname via DNS and
 * rejects URLs that resolve to private/loopback/reserved IP ranges, preventing
 * attackers from routing API requests through internal infrastructure.
 *
 * Usage:
 *   import { validateOutboundUrl } from '../common/ssrf';
 *   await validateOutboundUrl(userSuppliedUrl);
 *   const response = await httpService.get(userSuppliedUrl);
 */

import { BadRequestException } from '@nestjs/common';
import * as dns from 'dns/promises';
import * as net from 'net';

// RFC-reserved and private address ranges that must never be reachable from
// user-supplied URLs. Covers IPv4 private (RFC 1918), loopback (RFC 5735),
// link-local (RFC 3927), shared-address-space (RFC 6598), and IPv6 equivalents.
const BLOCKED_IPV4: RegExp[] = [
  /^127\./,                         // Loopback
  /^0\./,                           // This network (RFC 1122)
  /^10\./,                          // Class A private (RFC 1918)
  /^172\.(1[6-9]|2\d|3[01])\./,    // Class B private (RFC 1918)
  /^192\.168\./,                    // Class C private (RFC 1918)
  /^169\.254\./,                    // Link-local / APIPA (RFC 3927)
  /^100\.6[4-9]\.|^100\.[7-9]\d\.|^100\.1[01]\d\.|^100\.12[0-7]\./, // Shared (RFC 6598)
  /^198\.1[89]\./,                  // Benchmark testing (RFC 2544)
  /^192\.0\.2\./,                   // TEST-NET-1 (RFC 5737)
  /^198\.51\.100\./,                // TEST-NET-2 (RFC 5737)
  /^203\.0\.113\./,                 // TEST-NET-3 (RFC 5737)
  /^240\./,                         // Reserved (RFC 1112)
  /^255\.255\.255\.255$/,           // Broadcast
];

const BLOCKED_IPV6: RegExp[] = [
  /^::1$/,            // Loopback
  /^fc[0-9a-f]{2}:/i, // Unique local (fc00::/7)
  /^fd[0-9a-f]{2}:/i, // Unique local (fc00::/7)
  /^fe[89ab][0-9a-f]:/i, // Link-local (fe80::/10)
  /^::$/,             // Unspecified
  /^0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{1,4}$/, // IPv4-mapped loopback
];

const ALLOWED_SCHEMES = new Set(['https:', 'http:']);

// Platform-known external hosts that are always trusted regardless of IP check.
// Protects against DNS-based SSRF bypasses on known good endpoints.
const TRUSTED_HOST_PATTERNS: RegExp[] = [
  /\.googleapis\.com$/i,
  /\.youtube\.com$/i,
  /\.youtu\.be$/i,
  /\.ytimg\.com$/i,
  /\.ggpht\.com$/i,
  /\.openai\.com$/i,
  /\.anthropic\.com$/i,
  /\.api\.anthropic\.com$/i,
  /\.elevenlabs\.io$/i,
  /\.sentry\.io$/i,
  /\.stripe\.com$/i,
  /\.suno\.com$/i,
  /\.udio\.com$/i,
  /runwayml\.com$/i,
  /\.pika\.art$/i,
  /\.lumalabs\.ai$/i,
  /\.klingai\.com$/i,
  /\.cloudflare\.com$/i,
  /\.vercel\.app$/i,
  /\.railway\.app$/i,
];

export function isTrustedHost(hostname: string): boolean {
  return TRUSTED_HOST_PATTERNS.some((r) => r.test(hostname));
}

function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    return BLOCKED_IPV4.some((r) => r.test(ip));
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // Reject IPv4-mapped IPv6 (::ffff:192.168.x.x) by extracting the v4 part
    const v4mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4mapped) return BLOCKED_IPV4.some((r) => r.test(v4mapped[1]!));
    return BLOCKED_IPV6.some((r) => r.test(normalized));
  }
  return false;
}

/**
 * Validates that a URL is safe to fetch outbound from the server.
 *
 * Throws `BadRequestException` if:
 * - The URL is malformed or uses a non-HTTP/S scheme
 * - The hostname resolves to a private/reserved IP (SSRF risk)
 * - DNS lookup fails entirely (fail-closed)
 *
 * Trusted known-good hostnames (YouTube, Anthropic, Stripe, etc.) skip the IP
 * check to avoid false positives from CDN IPs in unusual ranges.
 */
export async function validateOutboundUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestException(`Malformed URL: unable to parse "${rawUrl.slice(0, 200)}"`);
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new BadRequestException(
      `Disallowed URL scheme "${parsed.protocol}" — only http: and https: are permitted`,
    );
  }

  const hostname = parsed.hostname;

  // Shortcut: if the hostname is a trusted platform host, allow without DNS lookup
  if (isTrustedHost(hostname)) return;

  // If the user passed a raw IP, check it directly without a DNS round-trip
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new BadRequestException(
        'SSRF: request to a private or reserved IP address is not allowed',
      );
    }
    return;
  }

  // Resolve DNS and check every returned address (DNS rebinding uses multiple A records)
  let addresses: string[];
  try {
    const [v4, v6] = await Promise.all([
      dns.resolve4(hostname).catch((): string[] => []),
      dns.resolve6(hostname).catch((): string[] => []),
    ]);
    addresses = [...v4, ...v6];
  } catch {
    throw new BadRequestException(`SSRF: could not resolve hostname "${hostname}"`);
  }

  if (addresses.length === 0) {
    throw new BadRequestException(`SSRF: hostname "${hostname}" has no DNS records`);
  }

  for (const addr of addresses) {
    if (isBlockedIp(addr)) {
      throw new BadRequestException(
        `SSRF: "${hostname}" resolves to a private/reserved address and cannot be fetched`,
      );
    }
  }
}
