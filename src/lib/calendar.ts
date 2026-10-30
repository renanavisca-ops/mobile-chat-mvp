'use client';

import { canNativeFiles, shareNativeFile } from '@/lib/native-files';

/** A chat event the user can add to their own calendar app. */
export type CalEvent = {
  title: string;
  /** ISO timestamp. */
  startsAt: string;
  /** ISO timestamp; defaults to start + 1h when absent. */
  endsAt?: string;
  location?: string;
  note?: string;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a date as a UTC calendar stamp: YYYYMMDDTHHMMSSZ. */
function toStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function endOf(ev: CalEvent): Date {
  if (ev.endsAt) return new Date(ev.endsAt);
  return new Date(new Date(ev.startsAt).getTime() + 60 * 60 * 1000);
}

/** A Google Calendar "create event" URL the user can open in any browser. */
export function googleCalendarUrl(ev: CalEvent): string {
  const start = new Date(ev.startsAt);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${toStamp(start)}/${toStamp(endOf(ev))}`,
  });
  if (ev.note) params.set('details', ev.note);
  if (ev.location) params.set('location', ev.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** A minimal RFC-5545 VEVENT the OS calendar can import. */
export function buildIcs(ev: CalEvent): string {
  const start = new Date(ev.startsAt);
  const uid = `${toStamp(start)}-${Math.random().toString(36).slice(2)}@toky`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Toky Chat//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toStamp(new Date())}`,
    `DTSTART:${toStamp(start)}`,
    `DTEND:${toStamp(endOf(ev))}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    ...(ev.location ? [`LOCATION:${icsEscape(ev.location)}`] : []),
    ...(ev.note ? [`DESCRIPTION:${icsEscape(ev.note)}`] : []),
    // Remind 30 minutes before.
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(ev.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

function safeName(title: string): string {
  return (title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'evento') + '.ics';
}

/**
 * Hand the event to the device's calendar: on native we share the .ics file
 * (the OS offers "Add to Calendar"); on the web we download it, which opens the
 * default calendar app. This is the reminder mechanism — no server infra.
 */
export async function addToCalendar(ev: CalEvent): Promise<void> {
  const ics = buildIcs(ev);
  const blob = new Blob([ics], { type: 'text/calendar' });
  const name = safeName(ev.title);
  if (canNativeFiles()) {
    await shareNativeFile(blob, name);
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 4000);
}
