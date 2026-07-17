import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, CheckCircle2, XCircle, Clock, Volume2, CalendarDays, Filter, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/DashboardLayout";
import QrScannerComponent from "@/components/QrScannerComponent";
import { toast } from "sonner";
import { getEvents, parseEventQrToken, extractStudentIdFromQr, type SchoolEvent } from "@/data/events";
import { getAllStudents, getSession, getAttendanceRecords, saveAttendanceRecord, clearAttendanceRecords, deleteAttendanceRecords, getSystemSettings, getStudentProfile, type AttendanceRecord, type StudentUser } from "@/lib/auth";
import { getSyncedTime, syncTimeWithServer } from "@/lib/timeSync";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { exportToCsv } from "@/lib/exportUtils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";



const parseTimeStringToMinutes = (timeString: string): number | null => {
  try {
    // 1. Check for "HH:mm" format (e.g., "08:30" from system settings)
    const hhmmMatch = timeString.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmmMatch) {
      return parseInt(hhmmMatch[1], 10) * 60 + parseInt(hhmmMatch[2], 10);
    }

    // 2. Original logic for event times (e.g., "10:00 AM - 11:00 AM")
    const startTimeStr = timeString.split(/[-–]/)[0].trim();
    const match = startTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return null;

    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    if (period === "PM" && h < 12) h += 12;
    if (period === "AM" && h === 12) h = 0;

    return h * 60 + m;
  } catch (err) {
    return null;
  }
};

const AdminScanner = () => {
  const navigate = useNavigate();
  const session = getSession();
  const adminRole = session?.adminRole;
  const [scannedRecords, setScannedRecords] = useState<AttendanceRecord[]>([]);
  // Keep a stable ref to the latest scannedRecords to avoid recreating handleScanSuccess on every poll
  const scannedRecordsRef = useRef<AttendanceRecord[]>([]);
  const [lastScan, setLastScan] = useState<AttendanceRecord | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>("all");
  const [allStudents, setAllStudents] = useState<StudentUser[]>([]);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [systemSettings, setSystemSettings] = useState({ lateThreshold: "08:30" });
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearMode, setClearMode] = useState<'selected' | 'all'>('all');

  // Confirmation dialog states
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [scannedStudent, setScannedStudent] = useState<StudentUser | null>(null);
  const [pendingRecord, setPendingRecord] = useState<AttendanceRecord | null>(null);
  const [isSavingRecord, setIsSavingRecord] = useState(false);

  useEffect(() => {
    if (!session || session.role !== "admin") {
      toast.error("Please log in as an admin to access this page");
      navigate("/login");
      return;
    }

    const fetchAttendance = async () => {
      try {
        const savedRecords = await getAttendanceRecords();
        scannedRecordsRef.current = savedRecords;
        setScannedRecords(savedRecords);
        setScanCount(savedRecords.length);
        if (savedRecords.length > 0) setLastScan(savedRecords[0]);
      } catch (err) {
        console.error("Failed to poll attendance records:", err);
      }
    };

    const init = async () => {
      setIsLoading(true);
      try {
        // Synchronize local time with server to support strict 10s token expiration
        await syncTimeWithServer();

        // Load system settings from the server (centralized)
        const settings = await getSystemSettings();
        if (settings) {
          setSystemSettings(settings);
        }

        // Parallel fetch with individual error handling for better resilience
        const results = await Promise.allSettled([
          getAttendanceRecords(),
          getEvents(),
          getAllStudents()
        ]);

        if (results[0].status === "fulfilled") {
          const savedRecords = results[0].value;
          scannedRecordsRef.current = savedRecords;
          setScannedRecords(savedRecords);
          setScanCount(savedRecords.length);
          if (savedRecords.length > 0) setLastScan(savedRecords[0]);
        } else {
          console.error("Attendance records fetch error:", results[0].reason);
          toast.error("Could not load attendance history");
        }

        if (results[1].status === "fulfilled") {
          setEvents(results[1].value);
        } else {
          console.error("Events fetch error:", results[1].reason);
          toast.error("Could not load events list");
        }

        if (results[2].status === "fulfilled") {
          setAllStudents(results[2].value);
        } else {
          console.error("Students fetch error:", results[2].reason);
          toast.error("Could not load student database");
        }

        // If all failed, show the primary error
        if (results.every(r => r.status === "rejected")) {
          throw new Error("Backend server unreachable. Please check port 3002.");
        }
      } catch (err: any) {
        console.error("Scanner sync error:", err);
        toast.error("Failed to sync scanner data", {
          description: err.message || "Please check if the backend server is running on port 3002."
        });
      } finally {
        setIsLoading(false);
      }
    };
    init();

    // Poll server every 4 seconds to sync scanner entries from phone and other devices
    const interval = setInterval(fetchAttendance, 4000);
    return () => clearInterval(interval);
  }, [session?.studentId, navigate]);

  const filteredRecords = useMemo(
    () =>
      selectedEventFilter === "all"
        ? scannedRecords
        : scannedRecords.filter((r) => r.eventId === selectedEventFilter),
    [scannedRecords, selectedEventFilter]
  );

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map((r) => r.id as string | number)));
    }
  }, [filteredRecords, selectedIds]);

  const toggleSelect = useCallback((id: string | number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }, [selectedIds]);

  const findStudent = (id: string) => {
    const student = allStudents.find(
      (u) => (u.studentId || "").trim().toLowerCase() === id.trim().toLowerCase()
    );
    if (student) {
      return {
        name: `${student.firstName} ${student.lastName}`,
        course: student.course,
        section: student.section,
        gender: student.gender,
      };
    }
    return null;
  };

  const playBeep = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 1200;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch { /* Audio not supported */ }
  }, []);

  const playErrorBeep = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 400;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch { /* Audio not supported */ }
  }, []);

  const handleScanSuccess = useCallback(
    async (decodedText: string) => {
      // Trim whitespace/newlines that scanner hardware can append
      const scannedText = decodedText.trim();

      // Parse token for event info; separately extract a clean student ID.
      // extractStudentIdFromQr() strips ALL noise (-EVTID-, -EVT-, -TS-) regardless of format.
      const parsed = parseEventQrToken(scannedText);
      const studentId = extractStudentIdFromQr(scannedText);
      const eventId = parsed?.eventId ?? "EVT-GENERAL";

      console.log("[Scanner] Parsed QR:", { studentId, eventId, raw: scannedText.slice(0, 80) });

      if (!studentId) {
        playErrorBeep();
        toast.error("Invalid QR Code", {
          description: `This code format is not recognized. Scanned: "${scannedText.slice(0, 100)}${scannedText.length > 100 ? '...' : ''}"`,
        });
        return;
      }

      // Security Check: 180 second (3 minute) expiry for tokens to handle minor clock drifts and loading delays
      if (parsed && parsed.timestamp) {
        const now = getSyncedTime();
        const ageInSeconds = (now - parsed.timestamp) / 1000;

        if (ageInSeconds > 180 || ageInSeconds < -30) {
          playErrorBeep();
          toast.error("QR Code Expired", {
            description: `This code was generated ${Math.round(Math.abs(ageInSeconds))}s ago. Please ask the student to refresh their QR code.`,
          });
          return;
        }
      }

      // Resolve event
      const event = events.find((e) => e.id === eventId);
      const eventName = event?.name ?? "General Attendance";

      // Check duplicate: same student + same event — use ref to get latest records without recreating callback
      if (scannedRecordsRef.current.some((r) => r.studentId.trim().toLowerCase() === studentId.toLowerCase() && r.eventId === eventId)) {
        playErrorBeep();
        toast.warning("Already scanned", {
          description: `Student ${studentId} was already recorded for ${eventName}.`,
        });
        return;
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // Strictly enforce the global Admin Late Threshold for all scans
      const thresholdMinutes = parseTimeStringToMinutes(systemSettings.lateThreshold) || 480; // Default 8:00 AM
      const status: "Present" | "Late" = currentMinutes >= thresholdMinutes ? "Late" : "Present";

      console.log("[Scanner] Scanning QR code payload:", decodedText);

      // Check pre-loaded students in memory first for instantaneous response
      const cachedStudent = allStudents.find(
        (u) => (u.studentId || "").trim().toLowerCase() === studentId.trim().toLowerCase()
      );

      if (cachedStudent) {
        const record: AttendanceRecord = {
          id: studentId,
          studentId: studentId,
          name: `${cachedStudent.firstName} ${cachedStudent.lastName}`,
          course: cachedStudent.course,
          section: cachedStudent.section,
          gender: cachedStudent.gender,
          time: timeStr,
          status,
          eventId,
          eventName,
          timestamp: now.getTime(),
        };

        setScannedStudent(cachedStudent);
        setPendingRecord(record);
        setShowConfirmDialog(true);
        playBeep(); // Instant success beep
      } else {
        // Fallback to live API fetch if not found in memory (e.g. newly registered during scan session)
        const fetchingToast = toast.loading("Fetching student details for verification...");
        try {
          const student = await getStudentProfile(studentId);
          toast.dismiss(fetchingToast);

          if (student) {
            // Add to cache so subsequent scans of this student are also instant
            setAllStudents((prev) => [...prev, student]);

            const record: AttendanceRecord = {
              id: studentId,
              studentId: studentId,
              name: `${student.firstName} ${student.lastName}`,
              course: student.course,
              section: student.section,
              gender: student.gender,
              time: timeStr,
              status,
              eventId,
              eventName,
              timestamp: now.getTime(),
            };

            setScannedStudent(student);
            setPendingRecord(record);
            setShowConfirmDialog(true);
            playBeep();
          } else {
            playErrorBeep();
            toast.error("Student Not Found", {
              description: `No student with ID "${studentId}" exists in the database. The student may not be registered yet.`,
            });
          }
        } catch (err: any) {
          toast.dismiss(fetchingToast);
          playErrorBeep();
          // Distinguish server error from genuine not-found
          toast.error("Server Error", {
            description: err?.message || "Could not reach the database. Please check server connectivity and try again.",
          });
        }
      }
    },
    // Note: scannedRecords removed from deps — we use scannedRecordsRef to prevent scanner re-init on every poll
    [playBeep, playErrorBeep, events, systemSettings.lateThreshold, allStudents]
  );
  
  const handleExport = () => {
    if (scannedRecords.length === 0) {
      toast.error("No records to export");
      return;
    }

    const sections = [
      {
        title: `AttendWise Scanner Attendance Export`,
        rows: [
          ["Export Generated", new Date().toLocaleString()],
          ["Total Scans in this Session", scannedRecords.length],
        ]
      },
      {
        title: "Scanned Records Log",
        headers: ["Student ID", "Full Name", "Course", "Section", "Gender", "Event", "Status", "Time"],
        rows: scannedRecords.map(s => [
          s.studentId || s.id, s.name, s.course, s.section, s.gender, s.eventName, s.status, s.time
        ])
      }
    ];

    const dateStr = new Date().toLocaleDateString('en-CA');
    const fileName = `Scanner_Attendance_${dateStr}.csv`;
    exportToCsv(fileName, sections);
    toast.success("Attendance records exported successfully");
  };


  // Unique events that have been scanned
  const scannedEventIds = [...new Set(scannedRecords.map((r) => r.eventId))];

  return (
    <DashboardLayout role="admin" adminRole={adminRole}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Camera className="h-7 w-7 text-gold" />
            Event QR Scanner
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Scan student QR codes to record event attendance in real-time
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Scanner */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-sans flex items-center gap-2">
                <Camera className="h-4 w-4 text-gold" />
                Camera Scanner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QrScannerComponent
                onScanSuccess={handleScanSuccess}
                onScanError={(err) => toast.error("Scanner Error", { description: err })}
              />
            </CardContent>
          </Card>

          {/* Stats & Last Scan */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card className="shadow-card">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground">{scanCount}</p>
                  <p className="text-xs text-muted-foreground">Total Scans</p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-success">
                    {scannedRecords.filter((r) => r.status === "Present").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Present</p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-warning">
                    {scannedRecords.filter((r) => r.status === "Late").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Late</p>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-sans">Last Scan Result</CardTitle>
              </CardHeader>
              <CardContent>
                {lastScan ? (
                  <div className="flex items-center gap-4">
                    <div
                      className={`h-14 w-14 rounded-full flex items-center justify-center shrink-0 ${lastScan.status === "Present" ? "bg-success/10" : "bg-warning/10"
                        }`}
                    >
                      {lastScan.status === "Present" ? (
                        <CheckCircle2 className="h-7 w-7 text-success" />
                      ) : (
                        <Clock className="h-7 w-7 text-warning" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-lg truncate">{lastScan.name}</p>
                      <p className="text-sm text-muted-foreground">{lastScan.id} • {lastScan.section}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">
                          <CalendarDays className="h-3 w-3 mr-1" />
                          {lastScan.eventName}
                        </Badge>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${lastScan.status === "Present"
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning"
                            }`}
                        >
                          {lastScan.status}
                        </span>
                        <span className="text-xs text-muted-foreground">{lastScan.time}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Camera className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No scans yet. Start the scanner and scan a student QR code.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <Volume2 className="h-3.5 w-3.5" />
              <span>Sound feedback enabled — beep on successful scan</span>
            </div>
          </div>
        </div>

        {/* Scanned Records Table */}
        {scannedRecords.length > 0 && (
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="text-base font-sans">
                  Scanned Records ({filteredRecords.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  {scannedEventIds.length > 1 && (
                    <Select value={selectedEventFilter} onValueChange={setSelectedEventFilter}>
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <Filter className="h-3 w-3 mr-1" />
                        <SelectValue placeholder="Filter by event" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Events</SelectItem>
                        {scannedEventIds.map((eid) => {
                          const evt = events.find((e) => e.id === eid);
                          return (
                            <SelectItem key={eid} value={eid}>
                              {evt?.name ?? eid}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}

                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-muted/30 text-xs font-medium text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Lateness threshold: {systemSettings.lateThreshold > "12:00" ? 
                      `${parseInt(systemSettings.lateThreshold.split(':')[0]) - 12}:${systemSettings.lateThreshold.split(':')[1]} PM` : 
                      `${systemSettings.lateThreshold} AM`}</span>
                  </div>

                   <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-3 w-3" />
                    Export CSV
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (selectedIds.size > 0) {
                        setClearMode('selected');
                        setShowClearConfirm(true);
                      } else {
                        setClearMode('all');
                        setShowClearConfirm(true);
                      }
                    }}
                  >
                    {selectedIds.size > 0 ? `Clear Selected (${selectedIds.size})` : "Clear All"}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {clearMode === 'all' ? 'Clear All Records?' : 'Clear Selected Records?'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {clearMode === 'all' 
                      ? 'This will permanently delete ALL attendance records from the server. This action cannot be undone.'
                      : `This will permanently delete the ${selectedIds.size} selected attendance records from the server.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={async (e) => {
                      e.preventDefault();
                      setIsDeleting(true);
                      try {
                        if (clearMode === 'selected') {
                          const idsToDelete = Array.from(selectedIds);
                          const success = await deleteAttendanceRecords(idsToDelete);
                          if (success) {
                            setScannedRecords(prev => prev.filter(r => !selectedIds.has(r.id as string | number)));
                            setSelectedIds(new Set());
                            setScanCount(c => c - idsToDelete.length);
                            toast.success(`${idsToDelete.length} records deleted`);
                          } else {
                            toast.error("Failed to delete selected records");
                          }
                        } else {
                          const success = await clearAttendanceRecords();
                          if (success) {
                            setScannedRecords([]);
                            setLastScan(null);
                            setScanCount(0);
                            setSelectedIds(new Set());
                            toast.success("All attendance records cleared");
                          } else {
                            toast.error("Failed to clear records");
                          }
                        }
                      } finally {
                        setIsDeleting(false);
                        setShowClearConfirm(false);
                      }
                    }} 
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Clear"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Student Identity Verification Pop-up Confirmation */}
            <AlertDialog open={showConfirmDialog} onOpenChange={(open) => {
              if (!open) {
                setShowConfirmDialog(false);
                setScannedStudent(null);
                setPendingRecord(null);
              }
            }}>
              <AlertDialogContent className="max-w-md bg-card border-border shadow-2xl rounded-2xl overflow-hidden p-0">
                {/* Header Banner */}
                <div className="h-20 bg-gradient-to-r from-primary to-primary/80 flex items-center justify-between px-6">
                  <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-gold" />
                    Verify Student Identity
                  </h3>
                  <Badge className="bg-gold/20 text-gold border-gold/40">
                    Scan Confirmed
                  </Badge>
                </div>
                
                <div className="p-6 space-y-6 flex flex-col items-center">
                  {/* Photo & Name Only */}
                  <div className="flex flex-col items-center text-center space-y-4 my-2">
                    <div className="w-64 h-64 border-4 border-card shadow-xl ring-4 ring-gold/20 relative rounded-2xl overflow-hidden bg-muted flex items-center justify-center">
                      {scannedStudent?.profileImage ? (
                        <img 
                          src={scannedStudent.profileImage} 
                          alt="Profile photo" 
                          className="h-full w-full object-contain" 
                        />
                      ) : (
                        <div className="bg-gradient-to-br from-gold to-amber-600 text-white text-5xl font-bold w-full h-full flex items-center justify-center">
                          {scannedStudent ? `${scannedStudent.firstName[0]}${scannedStudent.lastName[0]}` : "ST"}
                        </div>
                      )}
                    </div>
                    
                    <h4 className="text-2xl font-bold text-foreground text-center mt-2">
                      {scannedStudent?.firstName} {scannedStudent?.middleName ? `${scannedStudent.middleName[0]}. ` : ""}{scannedStudent?.lastName} {scannedStudent?.suffix || ""}
                    </h4>
                  </div>
                </div>

                
                {/* Actions */}
                <AlertDialogFooter className="p-4 bg-muted/20 border-t border-border flex sm:flex-row gap-2">
                  <AlertDialogCancel 
                    onClick={() => {
                      playErrorBeep();
                      toast.error("Deny Confirmation", {
                        description: "Attendance scan rejected by officer."
                      });
                      setShowConfirmDialog(false);
                      setScannedStudent(null);
                      setPendingRecord(null);
                    }}
                    className="flex-1 border-border/80 hover:bg-muted text-foreground"
                    disabled={isSavingRecord}
                  >
                    Deny / Reject
                  </AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!pendingRecord) return;
                      setIsSavingRecord(true);
                      try {
                        const result = await saveAttendanceRecord(pendingRecord);
                        if (result.ok) {
                          playBeep();
                          setScannedRecords((prev) => {
                            const updated = [pendingRecord, ...prev];
                            scannedRecordsRef.current = updated;
                            return updated;
                          });
                          setLastScan(pendingRecord);
                          setScanCount((c) => c + 1);
                          toast.success(`✅ Recorded: ${pendingRecord.name}`, {
                            description: `${pendingRecord.eventName} • ${pendingRecord.status} at ${pendingRecord.time}`,
                          });
                          setShowConfirmDialog(false);
                          setScannedStudent(null);
                          setPendingRecord(null);
                        } else {
                          playErrorBeep();
                          toast.error("Database Save Failed", {
                            description: result.error || "Could not save the attendance record.",
                          });
                        }
                      } catch (err) {
                        playErrorBeep();
                        toast.error("Network Error", {
                          description: "An error occurred while connecting to the database."
                        });
                      } finally {
                        setIsSavingRecord(false);
                      }
                    }} 
                    className="flex-1 bg-success hover:bg-success/90 text-success-foreground"
                    disabled={isSavingRecord}
                  >
                    {isSavingRecord ? "Recording..." : "Confirm & Save"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox 
                        checked={filteredRecords.length > 0 && selectedIds.size === filteredRecords.length}
                        onCheckedChange={() => toggleSelectAll()}
                      />
                    </TableHead>
                    <TableHead className="w-[60px]">No.</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((row, i) => (
                    <TableRow key={`${row.studentId || row.id}-${row.eventId}-${row.timestamp}-${i}`}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedIds.has(row.id as string | number)}
                          onCheckedChange={() => toggleSelect(row.id as string | number)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground font-medium">
                        {filteredRecords.length - i}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{row.studentId}</TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.course}</TableCell>
                      <TableCell>{row.section}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] bg-background">
                          {row.eventName || "General Attendance"}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.time}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${row.status === "Present"
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning"
                            }`}
                        >
                          {row.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminScanner;
