import { isIP } from "node:net";

function publicIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) return false;
  const [a, b, c] = octets;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false;
  return true;
}

function ipv6Groups(address: string): number[] | null {
  const input = address.replace(/^\[|\]$/g, "").toLowerCase();
  if (input.includes("%")) return null;
  const halves = input.split("::");
  if (halves.length > 2) return null;
  const parsePart = (part: string): number[] | null => {
    if (!part) return [];
    const output: number[] = [];
    for (const group of part.split(":")) {
      if (group.includes(".")) {
        const octets = group.split(".").map(Number);
        if (octets.length !== 4 || octets.some((v) => !Number.isInteger(v) || v < 0 || v > 255)) return null;
        output.push(octets[0] * 256 + octets[1], octets[2] * 256 + octets[3]);
      } else {
        if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
        output.push(parseInt(group, 16));
      }
    }
    return output;
  };
  const left = parsePart(halves[0]);
  const right = parsePart(halves[1] ?? "");
  if (!left || !right) return null;
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill(0), ...right];
  if (groups.length !== 8) return null;
  return groups;
}

function publicIpv6(address: string): boolean {
  const groups = ipv6Groups(address);
  if (!groups) return false;
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] <= 1) return false;
  if (
    groups.slice(0, 6).every((group) => group === 0) ||
    (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff)
  ) {
    const ipv4 = groups[6] * 65536 + groups[7];
    return publicIpv4(
      [ipv4 >>> 24, (ipv4 >>> 16) & 255, (ipv4 >>> 8) & 255, ipv4 & 255].join(".")
    );
  }
  if ((groups[0] & 0xfe00) === 0xfc00) return false;
  if ((groups[0] & 0xffc0) === 0xfe80) return false;
  if ((groups[0] & 0xff00) === 0xff00) return false;
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return false;
  return true;
}

export function isPublicNetworkAddress(address: string): boolean {
  const normalized = address.replace(/^\[|\]$/g, "");
  const version = isIP(normalized);
  if (version === 4) return publicIpv4(normalized);
  if (version === 6) return publicIpv6(normalized);
  return false;
}
