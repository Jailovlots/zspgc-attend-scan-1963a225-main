import { API_URL } from "./config";

export interface StudentUser {
  studentId: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  suffix?: string;
  email: string;
  course: string;
  yearLevel: string;
  section: string;
  gender: "Male" | "Female";
  role: "student" | "admin";
  adminId?: number;
  adminRole?: string;
  password?: string;
  phone?: string;
  birthday?: string;
  address?: string;
  city?: string;
  province?: string;
  zipCode?: string;
  semester?: string;
  schoolYear?: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelation?: string;
  profileImage?: string;
  profileImageUpdates?: number;
}

const SESSION_KEY = "attendwise_session";
const MIGRATED_KEY = "attendwise_migrated_v1";

// --- Auth & Session (Keep in localStorage for UX) ---
export const setSession = (user: StudentUser | null) => {
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
};

export const getSession = (): StudentUser | null => {
  const session = localStorage.getItem(SESSION_KEY);
  return session ? JSON.parse(session) : null;
};

export const logout = () => {
  setSession(null);
};

// --- Backend API Integration ---

export const loginUser = async (loginId: string, password: string, role: string): Promise<StudentUser | null> => {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, password, role })
    });
  } catch {
    throw new Error('NETWORK_ERROR');
  }
  if (res.status === 401) return null;  // bad credentials
  if (!res.ok) throw new Error('SERVER_ERROR');
  const user = await res.json();
  setSession(user);
  return user;
};

export const getAllStudents = async (): Promise<StudentUser[]> => {
  const res = await fetch(`${API_URL}/api/students`);
  return res.ok ? await res.json() : [];
};

export const getStudentProfile = async (id: string): Promise<StudentUser | null> => {
  // URL-encode the student ID so special characters (slashes, spaces, etc.)
  // don't corrupt the endpoint path, causing false "not found" errors.
  const res = await fetch(`${API_URL}/api/students/${encodeURIComponent(id.trim())}`);
  if (res.ok) return await res.json();
  if (res.status === 404) return null; // Genuine "not found"
  // For server errors (500, 503, etc.) throw so the caller can show the right message
  const body = await res.json().catch(() => ({}));
  throw new Error(body?.error || `Server error ${res.status}`);
};

export const saveUser = async (user: StudentUser & { bypassQualification?: boolean }): Promise<{ ok: boolean; error?: string }> => {
  const res = await fetch(`${API_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });
  if (res.ok) return { ok: true };
  const body = await res.json().catch(() => ({}));
  return { ok: false, error: body?.error || 'Registration failed' };
};

export const updateStudent = async (id: string, user: StudentUser): Promise<{ ok: boolean; error?: string }> => {
  const res = await fetch(`${API_URL}/api/students/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  });
  if (res.ok) return { ok: true };
  const body = await res.json().catch(() => ({}));
  return { ok: false, error: body?.error || 'Update failed' };
};

export const updateStudentAvatar = async (id: string, profileImage: string): Promise<{ ok: boolean; profileImageUpdates?: number; error?: string }> => {
  const res = await fetch(`${API_URL}/api/students/${id}/avatar`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileImage })
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) return { ok: true, profileImageUpdates: body.profileImageUpdates };
  return { ok: false, error: body?.error || 'Failed to update photo' };
};


export const deleteUser = async (studentId: string) => {
  const res = await fetch(`${API_URL}/api/students/${studentId}`, {
    method: 'DELETE'
  });
  return res.ok;
};

// --- Admin/Officer Accounts ---

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'officer' | 'superadmin';
  password: string;
  createdAt: string;
}

export const getAllAdmins = async (): Promise<AdminUser[]> => {
  const res = await fetch(`${API_URL}/api/admins`);
  return res.ok ? await res.json() : [];
};

export const createAdmin = async (admin: Omit<AdminUser, 'id' | 'createdAt'>): Promise<{ ok: boolean; data?: AdminUser; error?: string }> => {
  const res = await fetch(`${API_URL}/api/admins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(admin)
  });
  const body = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, data: body } : { ok: false, error: body?.error || 'Failed to create officer' };
};

export const updateAdmin = async (id: number, admin: Partial<AdminUser>): Promise<{ ok: boolean; error?: string }> => {
  const res = await fetch(`${API_URL}/api/admins/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(admin)
  });
  const body = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: body?.error || 'Failed to update officer' };
};

export const deleteAdmin = async (id: number): Promise<boolean> => {
  const res = await fetch(`${API_URL}/api/admins/${id}`, { method: 'DELETE' });
  return res.ok;
};

// --- Sections ---

export const getCourseSections = async (): Promise<Record<string, Record<string, string[]>>> => {
  const res = await fetch(`${API_URL}/api/sections`);
  return res.ok ? await res.json() : {};
};

export const saveCourseSections = async (sections: Record<string, Record<string, string[]>>) => {
  const res = await fetch(`${API_URL}/api/sections/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sections)
  });
  return res.ok;
};

export const saveSection = async (course: string, year: string, section: string) => {
  const res = await fetch(`${API_URL}/api/sections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ course, year, section })
  });
  return res.ok;
};

export const deleteSection = async (course: string, year: string, section: string) => {
  const res = await fetch(`${API_URL}/api/sections`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ course, year, section })
  });
  return res.ok;
};

export const renameSectionItem = async (oldName: string, newName: string, type: 'course' | 'section', course?: string, year?: string) => {
  const res = await fetch(`${API_URL}/api/sections/rename`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldName, newName, type, course, year })
  });
  return res.ok;
};

// --- Attendance ---

export interface AttendanceRecord {
  id: string; // unique scan id (legacy)
  studentId: string; // student's official ID
  name: string;
  course: string;
  section: string;
  time: string;
  status: "Present" | "Late";
  gender: "Male" | "Female";
  eventId: string;
  eventName: string;
  timestamp: number;
}

export const getAttendanceRecords = async (): Promise<AttendanceRecord[]> => {
  const res = await fetch(`${API_URL}/api/attendance`);
  return res.ok ? await res.json() : [];
};

export const saveAttendanceRecord = async (record: AttendanceRecord): Promise<{ ok: boolean; error?: string }> => {
  const res = await fetch(`${API_URL}/api/attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(record)
  });
  if (res.ok) return { ok: true };
  const body = await res.json().catch(() => ({}));
  return { ok: false, error: body?.error || 'Failed to save record' };
};

export const clearAttendanceRecords = async () => {
  const res = await fetch(`${API_URL}/api/attendance/clear`, {
    method: 'DELETE'
  });
  return res.ok;
};

export const deleteAttendanceRecords = async (ids: (string | number)[]) => {
  const res = await fetch(`${API_URL}/api/attendance/bulk`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });
  return res.ok;
};

export const getSystemSettings = async () => {
  const res = await fetch(`${API_URL}/api/settings`);
  if (res.ok) return await res.json();
  return null;
};

export const updateSystemSettings = async (settings: any) => {
  const res = await fetch(`${API_URL}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  return res.ok;
};

// --- One-time Migration logic ---
export const migrateLocalStorageToServer = async () => {
  if (localStorage.getItem(MIGRATED_KEY)) return;

  const users = JSON.parse(localStorage.getItem("attendwise_users") || "[]");
  const sections = JSON.parse(localStorage.getItem("attendwise_sections") || "null");
  const events = JSON.parse(localStorage.getItem("attendwise_events") || "[]");
  const attendance = JSON.parse(localStorage.getItem("attendwise_attendance") || "[]");

  if (users.length === 0 && !sections && events.length === 0 && attendance.length === 0) {
    localStorage.setItem(MIGRATED_KEY, "true");
    return;
  }

  console.log("Migrating data to server...");
  const res = await fetch(`${API_URL}/api/migrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ users, sections, events, attendance })
  });

  if (res.ok) {
    localStorage.setItem(MIGRATED_KEY, "true");
    console.log("Migration successful!");
  }
};

// --- Qualified Students ---

export interface QualifiedStudent {
  studentId: string;
  name: string;
}

export const getQualifiedStudents = async (): Promise<QualifiedStudent[]> => {
  const res = await fetch(`${API_URL}/api/qualified-students`);
  return res.ok ? await res.json() : [];
};

export const importQualifiedStudents = async (list: QualifiedStudent[]): Promise<{ ok: boolean; count?: number; error?: string }> => {
  const res = await fetch(`${API_URL}/api/qualified-students/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(list)
  });
  if (res.ok) {
    const data = await res.json();
    return { ok: true, count: data.count };
  }
  const body = await res.json().catch(() => ({}));
  return { ok: false, error: body?.error || 'Import failed' };
};

export const deleteQualifiedStudent = async (studentId: string): Promise<boolean> => {
  const res = await fetch(`${API_URL}/api/qualified-students/${encodeURIComponent(studentId)}`, {
    method: 'DELETE'
  });
  return res.ok;
};

export const clearQualifiedStudents = async (): Promise<boolean> => {
  const res = await fetch(`${API_URL}/api/qualified-students`, {
    method: 'DELETE'
  });
  return res.ok;
};
