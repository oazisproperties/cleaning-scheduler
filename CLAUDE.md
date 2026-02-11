# CLAUDE.md — cleaning-scheduler

## Overview

Shows all upcoming Guesty reservation checkouts (next 30 days) grouped by property. Checkbox next to each booking sends a 4-hour cleaning Google Calendar invite to the cleaning coordinator and marks the reservation's `kath_clean` custom field in Guesty as "yes".

## Live URLs

- **Vercel:** https://cleaning-scheduler-xi.vercel.app
- **Custom domain:** clean.oazis.properties
- **GitHub:** https://github.com/oazisproperties/cleaning-scheduler

## Tech Stack

- Next.js 15 (App Router) + TypeScript + React 19
- Tailwind CSS v4 (`@tailwindcss/postcss`)
- Guesty Open API (OAuth2 client credentials)
- Google Calendar API (service account) for calendar invites
- Vercel deployment
- oAZis brand theming (Teal #5FB8AD, Orange #D4874D, Cream #F5F1EB, Playfair Display headings)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GUESTY_CLIENT_ID` | Guesty OAuth2 client ID |
| `GUESTY_CLIENT_SECRET` | Guesty OAuth2 client secret |
| `GOOGLE_CLIENT_EMAIL` | Google service account email (`cleaning-scheduler@notional-clover-487001-q3.iam.gserviceaccount.com`) |
| `GOOGLE_PRIVATE_KEY` | Google service account private key (PEM format, newlines as `\n`) |
| `RESEND_API_KEY` | Resend API key — used to email ICS calendar invites to cleaning coordinator |

All env vars are set in Vercel for production, preview, and development.

## Guesty API

- **Token URL:** `https://open-api.guesty.com/oauth2/token`
- **API Base:** `https://open-api.guesty.com/v1`
- **Auth:** OAuth2 client credentials flow, in-memory token cache with 5-minute buffer
- **Reservations filter:** `$between` operator on `checkOut` field for next 30 days
- **Status filter:** Only `confirmed` and `checked_in` reservations
- **Custom field:** `kath_clean` — updated via dedicated `PUT /v1/reservations/{id}/custom-fields` endpoint using `fieldId` (not key name). The `fieldId` is discovered once via `GET /v1/reservations/{id}/custom-fields` and cached in memory.
- **Rate limiting:** Guesty has aggressive rate limits — avoid rapid repeated auth requests. Every Vercel deploy creates new serverless instances that cold-start fresh (in-memory token cache is lost).
- **IMPORTANT:** The `fields` parameter in the reservations query uses raw space-separated field names (NOT URL-encoded). Encoding the spaces broke the Guesty API. Do not change this format.

## Google Calendar API

- **Service account:** `cleaning-scheduler@notional-clover-487001-q3.iam.gserviceaccount.com`
- **Project:** `notional-clover-487001-q3`
- **Calendar usage:** Events are created on the service account's own calendar (`calendarId: "primary"`). Service accounts cannot add attendees without Domain-Wide Delegation, so notification is handled separately via email.
- **Timezone:** `America/Phoenix`

## Calendar Invites

- **Recipient:** colergetkathy@gmail.com
- **Event title:** "Cleaning at {Property}" where Property is the Guesty listing nickname
- **Duration:** 4 hours starting at the property's default checkout time (falls back to 11:00 AM)
- **Method:** Dual approach — (1) Google Calendar API `events.insert` creates event on service account's calendar, (2) Resend emails an ICS attachment to colergetkathy@gmail.com so she gets notified and can add it to her own calendar

## Key Files

- `src/app/page.tsx` — Client component. Fetches reservations on mount, groups by property, shows guest name (no confirmation code), displays days-to-clean gap between reservations, renders checkboxes to send invites. Pre-checks reservations where `kath_clean` is already "yes" in Guesty with "Scheduled" label.
- `src/app/api/reservations/route.ts` — GET returns upcoming checkouts from Guesty. Uses `export const dynamic = "force-dynamic"` to prevent build-time pre-rendering. Sets `Cache-Control: s-maxage=300` for Vercel edge caching.
- `src/app/api/send-invite/route.ts` — POST does three things in parallel via `Promise.all`: (1) creates Google Calendar event on service account's calendar, (2) emails ICS invite to colergetkathy@gmail.com via Resend, (3) updates `kath_clean` custom field in Guesty.
- `src/lib/guesty.ts` — OAuth2 token management, `getUpcomingCheckouts()`, `updateKathClean()`, and `discoverKathCleanFieldId()`. Uses `AbortController` for fetch timeouts (10s auth, 15s reservations). Caches both OAuth token and kath_clean fieldId in memory.
- `src/lib/google-calendar.ts` — Google Calendar API client using service account credentials. Creates events on the service account's own calendar (`calendarId: "primary"`).
- `src/lib/calendar.ts` — `generateICS()` function for creating ICS calendar attachments sent via Resend email.

## Commands

```bash
npm run dev      # Dev server on port 3000
npm run build    # Production build
npm run lint     # ESLint
```

## Session Notes (2026-02-09)

### What was done

1. **Replaced confirmation code with guest name** on each reservation row
2. **Added cleaning window display** — shows days between one guest's checkout and the next guest's checkin per property, color-coded (red = same-day, orange = 1 day, gray = 2+ days)
3. **Switched from Resend ICS email to Google Calendar API** — set up service account (`notional-clover-487001-q3`), shared calendar with colergetkathy@gmail.com, installed `googleapis` package
4. **Extended reservation window from 14 to 30 days**
5. **Added `kath_clean` custom field sync** — reads field on load to show "Scheduled" for already-processed reservations, writes "yes" when checkbox is clicked
6. **Added `export const dynamic = "force-dynamic"`** to reservations route to prevent Next.js from calling Guesty at build time (was causing build timeouts)
7. **Added AbortController timeouts** to all Guesty fetch calls
8. **Added Cache-Control `s-maxage=300`** header to reduce Guesty API hits from repeated page loads

### Current issue: page not loading reservations

The page is stuck on the loading spinner after deploys. Multiple fixes attempted:
- Removed infinite 429 retry loop
- Added fetch timeouts via AbortController
- Removed `customFields` from the Guesty `fields` parameter
- Reverted URL encoding of `fields` parameter back to raw spaces
- Set `export const dynamic = "force-dynamic"` to stop build-time pre-rendering

## Session Notes (2026-02-10)

### What was done

1. **Fixed Google Calendar invite error ("Not Found")** — Service account couldn't insert events directly into colergetkathy@gmail.com's calendar (requires calendar sharing). Changed to create events on the service account's own calendar (`calendarId: "primary"`).
2. **Fixed Domain-Wide Delegation error** — Service accounts can't add attendees to events without DWD. Removed attendees from the calendar event and added Resend ICS email as the notification mechanism instead.
3. **Implemented dual invite approach** — Checkbox now: (1) creates event on service account's Google Calendar, (2) emails ICS invite to Kathy via Resend, (3) updates `kath_clean` in Guesty — all in parallel.
4. **Fixed `kath_clean` custom field update** — The general `PUT /v1/reservations/{id}` endpoint with `{ customFields: [{ key, value }] }` doesn't work for custom fields. Switched to the dedicated `PUT /v1/reservations/{id}/custom-fields` endpoint which requires `fieldId` (Guesty's internal ID, not the variable name). Added `discoverKathCleanFieldId()` that looks up the fieldId via `GET /v1/reservations/{id}/custom-fields` and caches it in memory.

### What was resolved from previous session

- **Reservations now loading** — the 429 rate limit errors from the previous session's rapid deployments cleared on their own
- **Google Calendar invite tested** — works (event created, email sent)
- **`calendar.ts` and `resend` package are now actively used again** — the ICS generator and Resend are used to email calendar invites

### Pending / needs testing

1. **Verify `kath_clean` update works** — the dedicated custom-fields endpoint is deployed but untested. Console logs will show the field structure returned by Guesty. Check **Vercel Runtime Logs** after testing.
2. **Verify `kath_clean` read works on page load** — the reservations GET query doesn't include `customFields` in the `fields` parameter. `r.customFields` may be undefined, which would mean the "Scheduled" label never appears. If so, either remove the `fields` param entirely or call `GET /reservations/{id}/custom-fields` separately.
3. **Guesty rate limits remain a concern** — every deploy causes cold starts that lose in-memory caches (token + fieldId). Multiple rapid deploys can trigger 429s. Space out deploys when possible.
