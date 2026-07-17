import { API_URL } from "@/lib/config";
import { getSyncedTime } from "@/lib/timeSync";

export interface SchoolEvent {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  description: string;
  category: "general" | "course-specific";
  targetCourses: string[]; // empty = all courses
  status: "upcoming" | "ongoing" | "completed";
}

const EVENTS_KEY = "attendwise_events";

const DEFAULT_EVENTS: SchoolEvent[] = [
  {
    id: "EVT-2025-001",
    name: "Acquaintance Party",
    date: "2025-03-05",
    time: "1:00 PM – 5:00 PM",
    location: "ZDSPGC Gymnasium",
    description: "Welcome event for all students to meet and build connections.",
    category: "general",
    targetCourses: [],
    status: "upcoming",
  },
  {
    id: "EVT-2025-002",
    name: "Intramurals 2025",
    date: "2025-03-12",
    time: "7:00 AM – 5:00 PM",
    location: "ZDSPGC Sports Complex",
    description: "Annual intramural sports competition across all departments.",
    category: "general",
    targetCourses: [],
    status: "upcoming",
  },
  {
    id: "EVT-2025-003",
    name: "Foundations Week",
    date: "2025-03-20",
    time: "8:00 AM – 4:00 PM",
    location: "ZDSPGC Main Hall",
    description: "Academic foundation activities and seminars for all students.",
    category: "general",
    targetCourses: [],
    status: "upcoming",
  },
  {
    id: "EVT-2025-004",
    name: "BSIS Day",
    date: "2025-04-02",
    time: "8:00 AM – 5:00 PM",
    location: "ZDSPGC IT Building",
    description: "Celebration of IT excellence — tech talks, hackathon, and exhibits.",
    category: "course-specific",
    targetCourses: ["BSIS"],
    status: "upcoming",
  },
  {
    id: "EVT-2025-005",
    name: "BPEd Days",
    date: "2025-04-10",
    time: "7:00 AM – 4:00 PM",
    location: "ZDSPGC PE Grounds",
    description: "Physical education showcase — sports demos, teaching exhibits, and field day.",
    category: "course-specific",
    targetCourses: ["BPEd"],
    status: "upcoming",
  },
  {
    id: "EVT-2025-006",
    name: "ACT Summit",
    date: "2025-04-15",
    time: "9:00 AM – 3:00 PM",
    location: "ZDSPGC Auditorium",
    description: "Technology summit with workshops and project presentations for ACT students.",
    category: "course-specific",
    targetCourses: ["ACT"],
    status: "upcoming",
  },
];

export const getEvents = async (): Promise<SchoolEvent[]> => {
  const res = await fetch(`${API_URL}/api/events`);
  if (!res.ok) return DEFAULT_EVENTS;
  const events = await res.json();
  return events.length > 0 ? events : DEFAULT_EVENTS;
};

export const saveEvent = async (event: SchoolEvent) => {
  const res = await fetch(`${API_URL}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  });
  return res.ok;
};

export const deleteEvent = async (eventId: string) => {
  const res = await fetch(`${API_URL}/api/events/${eventId}`, {
    method: 'DELETE'
  });
  return res.ok;
};

// Generate a deterministic but unique QR token per student per event with 15s expiry support
export const generateEventQrToken = (
  studentId: string,
  studentName: string,
  eventId: string,
  eventName: string,
) => {
  const timestamp = getSyncedTime();
  const now = new Date(timestamp);
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });

  // Use a shorter hash for the visible token but keep it unique
  const hash = btoa(`${studentId}:${eventId}:${timestamp}`).replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();

  // Token format: ZDSPGC-STU-{studentId}-EVTID-{eventId}-TS-{timestamp}-{hash}
  return {
    token: `ZDSPGC-STU-${studentId}-EVTID-${eventId}-TS-${timestamp}-${hash}`,
    payload: {
      studentId,
      studentName,
      eventId,
      eventName,
      generatedDate: dateStr,
      generatedTime: timeStr,
      timestamp,
    },
  };
};

// Parse an event QR token
// Handles all formats:
//   NEW:    ZDSPGC-STU-{studentId}-EVTID-{eventId}-TS-{timestamp}-{hash}
//   LEGACY: ZDSPGC-STU-{studentId}-EVT-{eventId}-TS-{timestamp}-{hash}
//   BARE:   ZDSPGC-STU-{studentId}  OR just  {studentId}
export const parseEventQrToken = (token: string) => {
  const t = token.trim();
  
  // Strip ZDSPGC-STU- prefix if present
  const body = t.startsWith('ZDSPGC-STU-') ? t.slice('ZDSPGC-STU-'.length) : t;

  // ── Step 1: extract the trailing -TS-{timestamp}-{hash} block ──
  // Timestamp is 13 digits (ms since epoch). Hash is 1-16 alphanumeric chars.
  const tsMatch = body.match(/-TS-(\d{10,})-?([A-Za-z0-9]*)$/);
  if (tsMatch) {
    const timestamp = parseInt(tsMatch[1], 10);
    const hash = tsMatch[2] || 'LEGACY';
    // Everything before "-TS-{timestamp}..." is "{studentId}-EVTID-{eventId}" or "{studentId}-EVT-{eventId}"
    const beforeTs = body.slice(0, body.lastIndexOf('-TS-' + tsMatch[1]));

    // ── Step 2: try -EVTID- separator first (new unambiguous format) ──
    const evtidIdx = beforeTs.indexOf('-EVTID-');
    if (evtidIdx !== -1) {
      const studentId = beforeTs.slice(0, evtidIdx);
      const eventId   = beforeTs.slice(evtidIdx + 7); // len('-EVTID-') === 7
      if (studentId && eventId) {
        console.log('[QR] EVTID format:', { studentId, eventId, timestamp });
        return { studentId, eventId, timestamp, hash };
      }
    }

    // ── Step 3: try -EVT- separator (legacy format) ──
    // The event ID itself starts with 'EVT-', giving pattern: …-EVT-EVT-XXXX…
    // So the first occurrence of '-EVT-' is the separator.
    const evtIdx = beforeTs.indexOf('-EVT-');
    if (evtIdx !== -1) {
      const studentId = beforeTs.slice(0, evtIdx);
      const eventId   = beforeTs.slice(evtIdx + 5); // len('-EVT-') === 5
      if (studentId && eventId) {
        console.log('[QR] EVT legacy format:', { studentId, eventId, timestamp });
        return { studentId, eventId, timestamp, hash };
      }
    }

    // ── Step 4: no event separator – treat whole beforeTs as studentId ──
    if (beforeTs) {
      console.log('[QR] No-event format:', { studentId: beforeTs, timestamp });
      return { studentId: beforeTs, eventId: 'EVT-GENERAL', timestamp, hash };
    }
  }

  // ── Step 5: no timestamp block at all — bare student ID token ──
  if (body && !body.includes('-EVT-') && !body.includes('-EVTID-') && !body.includes('-TS-')) {
    console.log('[QR] Bare student ID:', body);
    return { studentId: body, eventId: 'EVT-GENERAL', timestamp: Date.now(), hash: 'LEGACY' };
  }

  // ── Step 6: last resort — cleanly extract the student ID portion ──
  // Do NOT return the raw body (it contains -EVTID-, -EVT-, -TS- noise).
  const cleanId = extractStudentIdFromQr(t);
  console.warn('[QR] Fallback extraction, studentId:', cleanId, '| raw:', body);
  return { studentId: cleanId ?? body, eventId: 'EVT-GENERAL', timestamp: Date.now(), hash: 'LEGACY' };
};

/**
 * Extracts ONLY the student ID from a QR token in any format.
 * Strips the ZDSPGC-STU- prefix and removes any event/timestamp suffixes.
 *
 * Supported formats:
 *   ZDSPGC-STU-{studentId}-EVTID-{eventId}-TS-{timestamp}-{hash}
 *   ZDSPGC-STU-{studentId}-EVT-{eventId}-TS-{timestamp}-{hash}
 *   ZDSPGC-STU-{studentId}
 *   {studentId}  (raw bare ID)
 */
export const extractStudentIdFromQr = (token: string): string | null => {
  const t = token.trim();
  if (!t) return null;

  // Strip ZDSPGC-STU- prefix
  let body = t.startsWith('ZDSPGC-STU-') ? t.slice('ZDSPGC-STU-'.length) : t;

  // Strip everything from the first known separator onward
  // Order: -EVTID- first (new format), then -EVT- (legacy), then -TS- (bare with timestamp)
  for (const sep of ['-EVTID-', '-EVT-', '-TS-']) {
    const idx = body.indexOf(sep);
    if (idx !== -1) {
      body = body.slice(0, idx);
    }
  }

  // Also strip a bare "-EVTID" suffix (without trailing dash) just in case
  if (body.endsWith('-EVTID')) {
    body = body.slice(0, body.length - 6);
  }

  return body.trim() || null;
};

