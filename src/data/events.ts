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

  // Token format: ZDSPGC-STU-{studentId}-EVT-{eventId}-TS-{timestamp}-{hash}
  return {
    token: `ZDSPGC-STU-${studentId}-EVT-${eventId}-TS-${timestamp}-${hash}`,
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
export const parseEventQrToken = (token: string) => {
  // Always trim whitespace/newlines that scanner hardware can append
  const t = token.trim();

  // Token format: ZDSPGC-STU-{studentId}-EVT-{eventId}-TS-{timestamp}-{hash}
  //
  // Problem: studentId and eventId can contain hyphens (e.g. "2023-453", "EVT-2025-001"),
  // which breaks naive regex splitting.
  //
  // Solution: anchor from known fixed landmarks:
  //   1. Strip the "ZDSPGC-STU-" prefix
  //   2. Find the LAST occurrence of "-TS-{digits}-{hash}" to extract timestamp + hash
  //   3. Everything between prefix and "-TS-" contains "{studentId}-EVT-{eventId}"
  //   4. Split that on the FIRST "-EVT-" to separate studentId from eventId

  const prefix = 'ZDSPGC-STU-';
  if (!t.startsWith(prefix)) {
    // Legacy fallback for very old tokens without event info
    const legacyMatch = t.match(/ZDSPGC-STU-([\w-]+)/);
    if (legacyMatch && !t.includes('-EVT-')) {
      return {
        studentId: legacyMatch[1].trim(),
        eventId: 'EVT-GENERAL',
        timestamp: Date.now(),
        hash: 'LEGACY',
      };
    }
    return null;
  }

  const body = t.slice(prefix.length); // e.g. "23S1125-EVT-EVT-2025-006-TS-1784264855345-ABCD1234"

  // Find "-TS-{digits}-{hash}" pattern — hash is alphanumeric (upper or lower)
  const tsMatch = body.match(/-TS-(\d+)-([A-Za-z0-9]+)$/);
  if (!tsMatch) {
    console.warn('[QR Parser] tsMatch failed. Body:', body);
    return null;
  }

  const timestamp = parseInt(tsMatch[1], 10);
  const hash = tsMatch[2];

  // Strip the "-TS-...{hash}" tail to get "{studentId}-EVT-{eventId}"
  const idEvtPart = body.slice(0, body.lastIndexOf('-TS-' + tsMatch[1]));

  // Split on the FIRST occurrence of "-EVT-" to separate studentId from eventId
  const evtIndex = idEvtPart.indexOf('-EVT-');
  if (evtIndex === -1) {
    console.warn('[QR Parser] -EVT- not found. idEvtPart:', idEvtPart);
    return null;
  }

  const studentId = idEvtPart.slice(0, evtIndex).trim();
  const eventId = idEvtPart.slice(evtIndex + 1).trim(); // keeps "EVT-..."

  if (!studentId || !eventId) {
    console.warn('[QR Parser] Empty studentId or eventId after split.', { studentId, eventId });
    return null;
  }

  console.log('[QR Parser] Parsed OK:', { studentId, eventId, timestamp });
  return { studentId, eventId, timestamp, hash };
};
