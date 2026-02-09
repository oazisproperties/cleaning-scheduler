export function generateICS(params: {
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string;
}): string {
  const { title, startTime, endTime, description } = params;

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
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}
