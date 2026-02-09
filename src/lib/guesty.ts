const TOKEN_URL = "https://open-api.guesty.com/oauth2/token";
const API_BASE = "https://open-api.guesty.com/v1";

// In-memory token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 300000) {
    return cachedToken.token;
  }

  const res = await fetch(TOKEN_URL, {
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
  confirmationCode: string;
}

export async function getUpcomingCheckouts(): Promise<Reservation[]> {
  const token = await getAccessToken();

  const now = new Date();
  const twoWeeksFromNow = new Date();
  twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);

  const fromDate = now.toISOString().split("T")[0];
  const toDate = twoWeeksFromNow.toISOString().split("T")[0];

  // Fetch reservations with checkout in the next 2 weeks
  const filters = JSON.stringify([
    { field: "checkOut", operator: "$between", from: `${fromDate}T00:00:00.000Z`, to: `${toDate}T23:59:59.999Z` },
  ]);

  const url = `${API_BASE}/reservations?filters=${encodeURIComponent(filters)}&limit=100&fields=_id listingId checkIn checkOut guestName confirmationCode status listing.nickname listing.defaultCheckOutTime listing.title`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

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
        confirmationCode: (r.confirmationCode as string) || "",
      };
    });
}
