import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createCalendarEvent } from "@/lib/google-calendar";
import { generateICS } from "@/lib/calendar";
import { updateKathClean } from "@/lib/guesty";

const resend = new Resend(process.env.RESEND_API_KEY);
const ATTENDEE_EMAIL = "colergetkathy@gmail.com";

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

    const summary = `Cleaning at ${propertyName}`;
    const description = `Cleaning scheduled after checkout at ${propertyName}`;

    // Create calendar event, send ICS email, and update Guesty in parallel
    await Promise.all([
      createCalendarEvent({ summary, description, startTime, endTime }),
      resend.emails.send({
        from: "oAZis Properties <admin@oazisproperties.com>",
        to: ATTENDEE_EMAIL,
        subject: summary,
        html: `<p>${description}</p><p>${startTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at ${startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} (4 hours)</p>`,
        attachments: [
          {
            filename: "cleaning.ics",
            content: Buffer.from(generateICS({
              title: summary,
              startTime,
              endTime,
              description,
              attendeeEmail: ATTENDEE_EMAIL,
            })).toString("base64"),
            contentType: "text/calendar",
          },
        ],
      }),
      updateKathClean(reservationId),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Send invite error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
