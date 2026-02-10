import { NextResponse } from "next/server";
import { getUpcomingCheckouts } from "@/lib/guesty";

// Cache the response for 5 minutes so deploys and page reloads
// don't each trigger a Guesty auth + API call
export const revalidate = 300;

export async function GET() {
  try {
    const reservations = await getUpcomingCheckouts();
    return NextResponse.json(reservations);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to fetch reservations:", message);
    return NextResponse.json(
      { error: `Failed to fetch reservations: ${message}` },
      { status: 500 }
    );
  }
}
