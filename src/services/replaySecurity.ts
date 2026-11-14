import dns from "node:dns/promises";
import net from "node:net";

export type ResolvedAddress = { address: string; family: number };

export const PRIVATE_IPV4_RANGES: Array<[number, number, number]> = [
  // [start, end, prefix] simplified as ranges
];

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return NaN;
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function inRange(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  if (net.isIP(base) !== 4) return false;
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (Number.isNaN(ipInt) || Number.isNaN(baseInt)) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

const BLOCKED_IPV4_CIDRS = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
  "255.255.255.255/32",
];

function isBlockedIPv4(ip: string): boolean {
  if (net.isIP(ip) !== 4) return false;
  // metadata endpoint explicitly
  if (ip === "169.254.169.254") return true;
  return BLOCKED_IPV4_CIDRS.some((c) => inRange(ip, c));
}

function isBlockedIPv6(ip: string): boolean {
  if (net.isIP(ip) !== 6) return false;
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA fc00::/7
  if (lower.startsWith("ff")) return true; // multicast
  if (lower.startsWith("2001:db8:")) return true; // documentation
  // IPv4-mapped (::ffff:a.b.c.d or ::ffff:7f00:1)
  const mappedMatch = lower.match(/^::ffff:(.+)$/);
  if (mappedMatch) {
    const embedded = mappedMatch[1];
    if (embedded.includes(".")) {
      return isBlockedIPv4(embedded);
    }
    // hex form: convert to dotted
    const hexParts = embedded.split(":");
    if (hexParts.length === 2) {
      const high = parseInt(hexParts[0], 16);
      const low = parseInt(hexParts[1], 16);
      if (!Number.isNaN(high) && !Number.isNaN(low)) {
        const ip = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
        return isBlockedIPv4(ip);
      }
    }
    // Any IPv4-mapped address is treated as the embedded IPv4; if unparseable, block.
    return true;
  }
  // IPv4-compatible (::a.b.c.d) deprecated but block.
  const compatMatch = lower.match(/^::(.+)$/);
  if (compatMatch && compatMatch[1].includes(".")) {
    return isBlockedIPv4(compatMatch[1]);
  }
  if (lower === "::" || lower === "::0") return true;
  return false;
}

export function isBlockedIP(ip: string, allowLoopback = false): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    if (allowLoopback && ip.startsWith("127.")) return false;
    return isBlockedIPv4(ip);
  }
  if (family === 6) {
    if (allowLoopback && (ip === "::1" || ip.toLowerCase() === "::1")) return false;
    return isBlockedIPv6(ip);
  }
  return true; // unknown -> block
}

export function isAllowedIP(ip: string, allowLoopback = false): boolean {
  return !isBlockedIP(ip, allowLoopback);
}

export function validateReplayBaseUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  // Reject userinfo
  if (url.username || url.password) return null;
  // Normalize: drop trailing slash? Keep origin + path. We'll store as origin.
  return url.origin;
}

export async function resolveAndValidateHost(
  hostname: string,
  allowLoopback = false,
): Promise<ResolvedAddress[]> {
  // If hostname is an IP literal, validate directly.
  if (net.isIP(hostname)) {
    if (!isAllowedIP(hostname, allowLoopback)) {
      throw new Error("Replay target host is not allowed");
    }
    return [{ address: hostname, family: net.isIP(hostname) }];
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("DNS resolution failed for replay target");
  }
  if (!addresses || addresses.length === 0) {
    throw new Error("DNS resolution failed for replay target");
  }
  // Block if ANY resolved address is not allowed (strict).
  for (const a of addresses) {
    if (!isAllowedIP(a.address, allowLoopback)) {
      throw new Error("Replay target resolves to a blocked address");
    }
  }
  return addresses;
}

export type SecureFetchOptions = {
  method: string;
  headers?: Record<string, string>;
  body?: string;
  maxBytes?: number;
  connectTimeoutMs?: number;
  totalTimeoutMs?: number;
  maxRedirects?: number;
  allowLoopback?: boolean;
};

export type SecureFetchResult = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  finalUrl: string;
};

const DEFAULT_MAX_BYTES = 1 * 1024 * 1024; // 1MB
const DEFAULT_CONNECT_TIMEOUT = 5000;
const DEFAULT_TOTAL_TIMEOUT = 15000;
const DEFAULT_MAX_REDIRECTS = 3;

function collectHeaders(resHeaders: any): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of Object.entries(resHeaders || {})) {
    out[k] = v as any;
  }
  return out;
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export async function secureFetch(
  targetUrl: string,
  options: SecureFetchOptions,
): Promise<SecureFetchResult> {
  const allowLoopback = options.allowLoopback === true;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const connectTimeout = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT;
  const totalTimeout = options.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let currentUrl = new URL(targetUrl);
  let method = options.method.toUpperCase();
  let body = options.body;
  let redirects = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (currentUrl.protocol !== "http:" && currentUrl.protocol !== "https:") {
      throw new Error("Unsupported protocol for replay target");
    }
    if (!currentUrl.hostname) {
      throw new Error("Invalid replay target host");
    }

    // Resolve + validate (DNS rebinding protection: resolve once per hop).
    const addresses = await resolveAndValidateHost(currentUrl.hostname, allowLoopback);
    const pinnedIp = addresses[0].address;

    const isHttps = currentUrl.protocol === "https:";
    const lib = isHttps ? await import("node:https") : await import("node:http");
    const mod = isHttps ? (lib as any).default || lib : (lib as any).default || lib;
    // Use require-style via global
    const httpModule: any = isHttps ? (await import("node:https")) : (await import("node:http"));
    const requestFn = httpModule.request || httpModule.default?.request;

    const port = currentUrl.port
      ? Number(currentUrl.port)
      : isHttps
        ? 443
        : 80;
    const path = (currentUrl.pathname || "/") + (currentUrl.search || "");

    const headers: Record<string, string> = { ...(options.headers || {}) };
    headers["host"] = currentUrl.hostname;
    if (body && !headers["content-type"]) {
      headers["content-type"] = "application/json";
    }
    if (body) {
      headers["content-length"] = String(Buffer.byteLength(body));
    }

    let aborted = false;
    const result = await new Promise<SecureFetchResult & { _redirect?: string }>((resolve, reject) => {
      const req = requestFn(
        {
          hostname: pinnedIp,
          port,
          path,
          method,
          headers,
          servername: isHttps ? currentUrl.hostname : undefined,
          timeout: connectTimeout,
        },
        (res: any) => {
          // Redirect handling
          if (isRedirect(res.statusCode) && res.headers.location) {
            res.resume();
            resolve({
              status: res.statusCode,
              headers: collectHeaders(res.headers),
              body: "",
              finalUrl: currentUrl.toString(),
              _redirect: res.headers.location,
            } as any);
            return;
          }

          const chunks: Buffer[] = [];
          let total = 0;
          let rejectFn: ((e: Error) => void) | null = null;
          // capture reject from outer promise via closure set below? We'll use req error event.
          res.on("data", (chunk: Buffer) => {
            if (aborted) return;
            total += chunk.length;
            if (total > maxBytes) {
              aborted = true;
              const err = new Error("Response exceeds maximum size");
              try { req.destroy(); } catch {}
              try { res.destroy(); } catch {}
              reject(err);
              return;
            }
            chunks.push(chunk);
          });
          res.on("end", () => {
            if (aborted) return;
            resolve({
              status: res.statusCode,
              headers: collectHeaders(res.headers),
              body: Buffer.concat(chunks).toString("utf8"),
              finalUrl: currentUrl.toString(),
            });
          });
          res.on("error", (err: Error) => {
            if (!aborted) reject(err);
          });
        },
      );

      const totalTimer = setTimeout(() => {
        req.destroy(new Error("Total request timeout"));
      }, totalTimeout);

      req.on("timeout", () => {
        req.destroy(new Error("Connection timeout"));
      });
      req.on("error", (err: Error) => {
        clearTimeout(totalTimer);
        if (aborted) return;
        reject(err);
      });
      req.on("close", () => {
        clearTimeout(totalTimer);
      });

      if (body && method !== "GET" && method !== "HEAD") {
        req.write(body);
      }
      req.end();
    });

    // Handle redirect
    if ((result as any)._redirect) {
      if (redirects >= maxRedirects) {
        throw new Error("Too many redirects");
      }
      redirects++;
      const nextUrl = new URL((result as any)._redirect, currentUrl);
      // Validate redirect target host (DNS) before following.
      await resolveAndValidateHost(nextUrl.hostname, allowLoopback);
      // Method/body adjustment per standard.
      if (result.status === 303) {
        method = "GET";
        body = undefined;
      } else if (result.status === 301 || result.status === 302) {
        if (method !== "GET" && method !== "HEAD") {
          method = "GET";
          body = undefined;
        }
      }
      currentUrl = nextUrl;
      continue;
    }

    return {
      status: result.status,
      headers: result.headers,
      body: result.body,
      finalUrl: result.finalUrl,
    };
  }
}
