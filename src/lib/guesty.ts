const TOKEN_URL = "https://open-api.guesty.com/oauth2/token";
const API_BASE = "https://open-api.guesty.com/v1";

// In-memory token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  return Promise.race([
    fetch(url, options),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

async function getAccessToken(attempt = 0): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300000) {
    return cachedToken.token;
  }

  const res = await fetchWithTimeout(TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "open-api",
      client_id: process.env.GUESTY_CLIENT_ID!,
      client_secret: process.env.GUESTY_CLIENT_SECRET!,
    }),
  });

  if (res.status === 429 && attempt < 2) {
    const retryAfter = res.headers.get("retry-after");
    const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return getAccessToken(attempt + 1);
  }

  if (!res.ok) throw new Error(`Guesty auth failed: ${res.status}`);
  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

export interface Reservation {
  id: string;
  listingId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  checkOutTime: string;
  guestName: string;
  kathClean: boolean;
}

export async function getUpcomingCheckouts(): Promise<Reservation[]> {
  const token = await getAccessToken();

  const now = new Date();
  const thirtyDaysOut = new Date();
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

  const fromDate = now.toISOString().split("T")[0];
  const toDate = thirtyDaysOut.toISOString().split("T")[0];

  const filters = JSON.stringify([
    { field: "checkOut", operator: "$between", from: `${fromDate}T00:00:00.000Z`, to: `${toDate}T23:59:59.999Z` },
  ]);

  const fields = [
    "_id", "listingId", "checkIn", "checkOut", "guestName",
    "status", "listing.nickname", "listing.defaultCheckOutTime", "listing.title",
  ].join(" ");

  const url = `${API_BASE}/reservations?filters=${encodeURIComponent(filters)}&limit=100&fields=${encodeURIComponent(fields)}`;

  const res = await fetchWithTimeout(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }, 15000);

  if (!res.ok) throw new Error(`Guesty reservations failed: ${res.status}`);
  const data = await res.json();

  return (data.results || [])
    .filter(
      (r: Record<string, unknown>) =>
        r.status === "confirmed" || r.status === "checked_in"
    )
    .map((r: Record<string, unknown>) => {
      const listing = r.listing as
        | Record<string, unknown>
        | undefined;

      // Check kath_clean custom field
      const customFields = r.customFields as
        | Array<{ fieldId: string; key: string; value: unknown }>
        | undefined;
      const kathField = customFields?.find(
        (f) => f.key === "kath_clean"
      );
      const kathClean =
        kathField?.value === "yes" ||
        kathField?.value === "Yes" ||
        kathField?.value === true;

      return {
        id: r._id as string,
        listingId: r.listingId as string,
        propertyName:
          (listing?.nickname as string) ||
          (listing?.title as string) ||
          "Unknown Property",
        checkIn: r.checkIn as string,
        checkOut: r.checkOut as string,
        checkOutTime:
          (listing?.defaultCheckOutTime as string) || "11:00",
        guestName: (r.guestName as string) || "Guest",
        kathClean,
      };
    });
}

export async function updateKathClean(reservationId: string): Promise<void> {
  const token = await getAccessToken();

  const res = await fetchWithTimeout(`${API_BASE}/reservations/${reservationId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customFields: [{ key: "kath_clean", value: "yes" }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update kath_clean: ${res.status} ${text}`);
  }
}
