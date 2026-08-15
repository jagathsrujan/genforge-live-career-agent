import { lookup } from "node:dns/promises";
import net from "node:net";

const blockedAddresses = new net.BlockList();
const blockedSubnets: Array<[string, number, "ipv4" | "ipv6"]> = [
  ["0.0.0.0", 8, "ipv4"],
  ["10.0.0.0", 8, "ipv4"],
  ["100.64.0.0", 10, "ipv4"],
  ["127.0.0.0", 8, "ipv4"],
  ["169.254.0.0", 16, "ipv4"],
  ["172.16.0.0", 12, "ipv4"],
  ["192.0.0.0", 24, "ipv4"],
  ["192.0.2.0", 24, "ipv4"],
  ["192.168.0.0", 16, "ipv4"],
  ["198.18.0.0", 15, "ipv4"],
  ["198.51.100.0", 24, "ipv4"],
  ["203.0.113.0", 24, "ipv4"],
  ["224.0.0.0", 4, "ipv4"],
  ["240.0.0.0", 4, "ipv4"],
  ["::1", 128, "ipv6"],
  ["fc00::", 7, "ipv6"],
  ["fe80::", 10, "ipv6"],
  ["::ffff:0:0", 96, "ipv6"],
];
for (const [address, prefix, family] of blockedSubnets) blockedAddresses.addSubnet(address, prefix, family);

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function isPrivateHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!normalized || normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local")) return true;
  if (net.isIP(normalized) === 4) return isPrivateIpv4(normalized) || isBlockedAddress(normalized);
  if (net.isIP(normalized) === 6) return isBlockedAddress(normalized);
  return false;
}

function isBlockedAddress(address: string) {
  const normalized = address.replace(/^\[|\]$/g, "").split("%")[0];
  const ipVersion = net.isIP(normalized);
  if (!ipVersion) return false;
  return blockedAddresses.check(normalized, ipVersion === 6 ? "ipv6" : "ipv4");
}

export function isSafePublicUrl(input: string) {
  try {
    const url = new URL(input);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (url.username || url.password) return false;
    return !isPrivateHostname(url.hostname);
  } catch {
    return false;
  }
}

export function assertSafePublicUrl(input: string) {
  if (!isSafePublicUrl(input)) throw new Error("Only public http(s) URLs without credentials are allowed.");
  return new URL(input);
}

export async function assertSafePublicUrlAsync(input: string) {
  const url = assertSafePublicUrl(input);
  if (net.isIP(url.hostname)) {
    if (isBlockedAddress(url.hostname)) throw new Error("Private or reserved network addresses are not allowed.");
    return url;
  }
  let addresses;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("The public host could not be resolved.");
  }
  if (!addresses.length || addresses.some((entry) => isBlockedAddress(entry.address))) {
    throw new Error("The public host resolves to a private or reserved network address.");
  }
  return url;
}
