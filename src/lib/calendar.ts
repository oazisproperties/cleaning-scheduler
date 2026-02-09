export function generateICS(params: {
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string;
  attendeeEmail?: string;
}): string {
  const { title, startTime, endTime, description, attendeeEmail } = params;

  function formatDate(date: Date): string {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  const uid = `${Date.now()}-${Math.random().toString(36).substring(2)}@oazis.properties`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//oAZis Properties//Cleaning Scheduler//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${formatDate(startTime)}`,
    `DTEND:${formatDate(endTime)}`,
    `SUMMARY:${title}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, "\\n")}` : "",
    `DTSTAMP:${formatDate(new Date())}`,
    "ORGANIZER;CN=oAZis Properties:mailto:admin@oazisproperties.com",
    attendeeEmail
      ? `ATTENDEE;RSVP=TRUE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION:mailto:${attendeeEmail}`
      : "",
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}
