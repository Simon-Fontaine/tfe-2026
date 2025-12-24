import {
  type GeoLookupResponse,
  geoLookupResponseSchema,
} from "@workspaces/shared";

export async function lookupGeo(ip: string): Promise<GeoLookupResponse | null> {
  if (isLocalIp(ip)) {
    return {
      status: "success",
      query: ip,
      country: "Local Dev",
      countryCode: "LD",
      region: "Local Dev",
      regionName: "Local Dev",
      city: "Local Dev",
      zip: "00000",
      lat: 0,
      lon: 0,
      timezone: "UTC",
      isp: "Localhost",
      org: "Localhost",
      as: "Localhost",
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(`http://ip-api.com/json/${ip}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Geo lookup failed with status ${response.status}`);
    }

    const json = await response.json();
    const parsed = geoLookupResponseSchema.safeParse(json);

    if (parsed.success) {
      return parsed.data;
    } else {
      console.error("Geo lookup validation failed:", parsed.error);
      return null;
    }
  } catch (error) {
    console.error("Geo lookup failed:", error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isLocalIp(ip: string): boolean {
  return (
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip === "localhost" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.")
  );
}
