import { NextResponse } from "next/server";
import { createCalendarEvent } from "@/lib/google-calendar";

export async function POST(request: Request) {
  try {
    const { reservationId, propertyName, checkOut, checkOutTime } =
      await request.json();

    if (!reservationId || !propertyName || !checkOut) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Build the event start time from checkout date + checkout time
    const [year, month, day] = checkOut
      .split("T")[0]
      .split("-")
      .map(Number);
    const [hours, minutes] = (checkOutTime || "11:00")
      .split(":")
      .map(Number);
    const startTime = new Date(year, month - 1, day, hours, minutes);
    const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000);

    await createCalendarEvent({
      summary: `Cleaning at ${propertyName}`,
      description: `Cleaning scheduled after checkout at ${propertyName}`,
      startTime,
      endTime,
      attendeeEmail: "colergetkathy@gmail.com",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Send invite error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
