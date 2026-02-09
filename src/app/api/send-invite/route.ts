import { NextResponse } from "next/server";
import { Resend } from "resend";
import { generateICS } from "@/lib/calendar";

const resend = new Resend(process.env.RESEND_API_KEY);

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
    const endTime = new Date(startTime.getTime() + 4 * 60 * 60 * 1000); // 4 hours later

    const title = `Cleaning at ${propertyName}`;

    const ics = generateICS({
      title,
      startTime,
      endTime,
      description: `Cleaning scheduled after checkout at ${propertyName}`,
    });

    // Send via Resend with ICS attachment
    const { error } = await resend.emails.send({
      from: "oAZis Properties <onboarding@resend.dev>",
      to: "colergetkathy@gmail.com",
      subject: title,
      html: `<p>A cleaning has been scheduled:</p><p><strong>${title}</strong></p><p>Date: ${startTime.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p><p>Time: ${startTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${endTime.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>`,
      attachments: [
        {
          filename: "cleaning-invite.ics",
          content: Buffer.from(ics).toString("base64"),
          contentType: "text/calendar",
        },
      ],
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Send invite error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
