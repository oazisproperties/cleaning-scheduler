import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/calendar"];

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: SCOPES,
  });
}

export async function createCalendarEvent(params: {
  summary: string;
  description: string;
  startTime: Date;
  endTime: Date;
  attendeeEmail: string;
}) {
  const { summary, description, startTime, endTime, attendeeEmail } = params;

  const auth = getAuth();
  const calendar = google.calendar({ version: "v3", auth });

  const event = await calendar.events.insert({
    calendarId: "primary",
    sendUpdates: "all",
    requestBody: {
      summary,
      description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: "America/Phoenix",
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: "America/Phoenix",
      },
      attendees: [{ email: attendeeEmail }],
    },
  });

  return event.data;
}
