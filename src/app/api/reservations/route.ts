import { NextResponse } from "next/server";
import { getUpcomingCheckouts } from "@/lib/guesty";

// Never pre-render at build time — only run on request
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const reservations = await getUpcomingCheckouts();
    return NextResponse.json(reservations, {
      headers: {
        // Cache on Vercel edge for 5 minutes to reduce Guesty API calls
        "Cache-Control": "s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to fetch reservations:", message);
    return NextResponse.json(
      { error: `Failed to fetch reservations: ${message}` },
      { status: 500 }
    );
  }
}
