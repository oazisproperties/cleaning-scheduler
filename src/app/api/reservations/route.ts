import { NextRequest, NextResponse } from "next/server";
import { getUpcomingCheckouts } from "@/lib/guesty";

export async function GET(request: NextRequest) {
  try {
    const debug = request.nextUrl.searchParams.get("debug") === "true";
    const reservations = await getUpcomingCheckouts(debug);
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
