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
  const prefix = 'ZDSPGC-STU-';
  
  let body = t;
  if (body.startsWith(prefix)) {
    body = body.slice(prefix.length);
  }

  // Check if it's the new format with timestamp and hash:
  // e.g., studentId-EVT-eventId-TS-timestamp-hash
  const tsMatch = body.match(/-TS-(\d+)-([A-Za-z0-9]+)$/);
  if (tsMatch) {
    const timestamp = parseInt(tsMatch[1], 10);
    const hash = tsMatch[2];
    const idEvtPart = body.slice(0, body.lastIndexOf('-TS-' + tsMatch[1]));
    
    // Split at the first "-EVT-"
    const evtIndex = idEvtPart.indexOf('-EVT-');
    if (evtIndex !== -1) {
      let studentId = idEvtPart.slice(0, evtIndex).trim();
      // Clean up any potential leftover EVT parts just in case
      if (studentId.includes('-EVT-')) {
        studentId = studentId.split('-EVT-')[0].trim();
      }
      // Since "-EVT-" is 5 characters long, we slice from evtIndex + 5 to get the eventId correctly
      const eventId = idEvtPart.slice(evtIndex + 5).trim();
      
      if (studentId && eventId) {
        console.log('[QR Parser] Parsed OK:', { studentId, eventId, timestamp });
        return { studentId, eventId, timestamp, hash };
      }
    }
  }

  // Fallback for legacy format:
  // Can be "ZDSPGC-STU-studentId" or just "studentId"
  // We want to make sure it doesn't contain -EVT- or -TS- to avoid matching a corrupt new token as a student ID
  if (!body.includes('-EVT-') && !body.includes('-TS-')) {
    const studentId = body.trim();
    if (studentId) {
      return {
        studentId,
        eventId: 'EVT-GENERAL',
        timestamp: Date.now(),
        hash: 'LEGACY',
      };
    }
  }

  console.warn('[QR Parser] Failed to parse token:', t);
  return null;
};
