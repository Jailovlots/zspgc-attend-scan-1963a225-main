import { useState, useMemo, useEffect } from "react";
import {
    BarChart3, Download, Search, Filter, Calendar, Users,
    CheckCircle2, Clock, XCircle, FileSpreadsheet, ChevronDown, Printer,
    ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { getAllStudents, getAttendanceRecords, getCourseSections, getSession, type StudentUser, type AttendanceRecord } from "@/lib/auth";
import { getEvents, type SchoolEvent } from "@/data/events";
import { toast } from "sonner";
import { exportToCsv, type CSVSection } from "@/lib/exportUtils";
import { useNavigate } from "react-router-dom";

// ─── Types ───────────────────────────────────────────────────────────────────
interface StudentRow {
    studentId: string;
    name: string;
    course: string;
    yearLevel: string;
    section: string;
    gender: string;
    status: "Present" | "Late" | "Absent";
    time: string;
}

const STATUS_COLOR: Record<string, string> = {
    Present: "bg-emerald-100 text-emerald-700",
    Late: "bg-yellow-100 text-yellow-700",
    Absent: "bg-red-100 text-red-700",
};

const PIE_COLORS = ["hsl(142,72%,40%)", "hsl(38,92%,50%)", "hsl(0,84%,60%)"];
const BAR_COLORS = { present: "hsl(142,72%,40%)", late: "hsl(38,92%,50%)", absent: "hsl(0,84%,60%)" };

// ─── Component ───────────────────────────────────────────────────────────────
const AdminReports = () => {
    const navigate = useNavigate();
    const session = getSession();
    const adminRole = session?.adminRole;
    const [events, setEvents] = useState<SchoolEvent[]>([]);
    const [students, setStudents] = useState<StudentUser[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedEventId, setSelectedEventId] = useState<string>("all");
    const [courseFilter, setCourseFilter] = useState("all");
    const [yearFilter, setYearFilter] = useState("all");
    const [sectionFilter, setSectionFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [courseSections, setCourseSections] = useState<Record<string, Record<string, string[]>>>({});
    const [sortField, setSortField] = useState<"name" | "course" | "yearLevel" | "section" | null>("name");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

    const handleSort = (field: "name" | "course" | "yearLevel" | "section") => {
        if (sortField === field) {
            if (sortOrder === "asc") {
                setSortOrder("desc");
            } else {
                setSortField(null);
            }
        } else {
            setSortField(field);
            setSortOrder("asc");
        }
    };

    // ── Load data ──────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!session || session.role !== "admin") {
            toast.error("Please log in as an admin to access this page");
            navigate("/login");
            return;
        }

        if (session.adminRole === "officer") {
            toast.error("You do not have permission to access the Reports page");
            navigate("/admin");
            return;
        }

        const init = async () => {
            setIsLoading(true);
            try {
                const [ev, stu, att, sections] = await Promise.all([
                    getEvents(),
                    getAllStudents(),
                    getAttendanceRecords(),
                    getCourseSections()
                ]);
                setEvents(ev);
                setStudents(stu.filter((s) => s.role === "student"));
                setAttendance(att);
                setCourseSections(sections);
            } catch {
                toast.error("Failed to load report data");
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, []);

    const COURSES = useMemo(() => {
        const all = [...new Set(students.map((s) => s.course).filter(Boolean))].sort();
        return ["all", ...all];
    }, [students]);

    // Dynamically retrieve available sections based on course and year selection
    const availableSections = useMemo(() => {
        let list = students;
        if (courseFilter !== "all") {
            list = list.filter(s => s.course === courseFilter);
        }
        if (yearFilter !== "all") {
            list = list.filter(s => s.yearLevel === yearFilter);
        }
        const uniqueSections = [...new Set(list.map(s => s.section).filter(Boolean))].sort();
        return ["all", ...uniqueSections];
    }, [students, courseFilter, yearFilter]);

    // Reset section filter when course or year filters change
    useEffect(() => {
        setSectionFilter("all");
    }, [courseFilter, yearFilter]);

    // ── Filtered attendance for selected event ─────────────────────────────────
    const eventAttendance = useMemo(() => {
        if (selectedEventId === "all") return attendance;
        return attendance.filter((r) => r.eventId === selectedEventId);
    }, [attendance, selectedEventId]);

    // ── Build per-student rows ─────────────────────────────────────────────────
    const studentRows = useMemo<StudentRow[]>(() => {
        // Which students are in scope?
        let scopedStudents = students;
        if (courseFilter !== "all") {
            scopedStudents = scopedStudents.filter((s) => s.course === courseFilter);
        }
        if (yearFilter !== "all") {
            scopedStudents = scopedStudents.filter((s) => s.yearLevel === yearFilter);
        }
        if (sectionFilter !== "all") {
            scopedStudents = scopedStudents.filter((s) => s.section === sectionFilter);
        }

        return scopedStudents.map((s) => {
            const rec = eventAttendance.find((r) => r.studentId === s.studentId);
            return {
                studentId: s.studentId ?? "",
                name: `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim(),
                course: s.course ?? "",
                yearLevel: s.yearLevel ?? "",
                section: s.section ?? "",
                gender: s.gender ?? "",
                status: rec ? rec.status : "Absent",
                time: rec ? rec.time : "—",
            };
        });
    }, [students, eventAttendance, courseFilter, yearFilter, sectionFilter]);

    // ── Apply additional filters ───────────────────────────────────────────────
    const filteredRows = useMemo(() => {
        return studentRows.filter((r) => {
            const matchStatus = statusFilter === "all" || r.status === statusFilter;
            const q = searchQuery.toLowerCase();
            const matchSearch =
                !q ||
                r.name.toLowerCase().includes(q) ||
                r.studentId.toLowerCase().includes(q) ||
                r.section.toLowerCase().includes(q);
            return matchStatus && matchSearch;
        });
    }, [studentRows, statusFilter, searchQuery]);

    // ── Sort filtered rows ─────────────────────────────────────────────────────
    const sortedRows = useMemo(() => {
        if (!sortField) return filteredRows;
        return [...filteredRows].sort((a, b) => {
            const valA = a[sortField] || "";
            const valB = b[sortField] || "";
            return sortOrder === "asc"
                ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
                : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
        });
    }, [filteredRows, sortField, sortOrder]);

    // ── Summary stats ──────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const total = studentRows.length;
        const present = studentRows.filter((r) => r.status === "Present").length;
        const late = studentRows.filter((r) => r.status === "Late").length;
        const absent = studentRows.filter((r) => r.status === "Absent").length;
        const rate = total ? Math.round(((present + late) / total) * 100) : 0;
        return { total, present, late, absent, rate };
    }, [studentRows]);

    // ── Pie data ───────────────────────────────────────────────────────────────
    const pieData = useMemo(() => [
        { name: "Present", value: stats.present },
        { name: "Late", value: stats.late },
        { name: "Absent", value: stats.absent },
    ], [stats]);

    // ── Per-section bar data ───────────────────────────────────────────────────
    const sectionData = useMemo(() => {
        const map: Record<string, { section: string; present: number; late: number; absent: number }> = {};
        studentRows.forEach((r) => {
            const key = `${r.section}`;
            if (!map[key]) map[key] = { section: r.section || "—", present: 0, late: 0, absent: 0 };
            if (r.status === "Present") map[key].present++;
            else if (r.status === "Late") map[key].late++;
            else map[key].absent++;
        });
        return Object.values(map).sort((a, b) => a.section.localeCompare(b.section));
    }, [studentRows]);

    // ── Selected event info ────────────────────────────────────────────────────
    const selectedEvent = events.find((e) => e.id === selectedEventId);

    // ── CSV Export ─────────────────────────────────────────────────────────────
    const handleExport = () => {
        const eventLabel = selectedEvent ? selectedEvent.name : "All Events";
        const dateStamp = new Date().toLocaleDateString();

        const sections: CSVSection[] = [
            {
                title: `AttendWise Attendance Report - ${eventLabel}`,
                rows: [
                    ["Export Date", dateStamp],
                    ["Course Filter", courseFilter === "all" ? "All Courses" : courseFilter],
                    ["Year Level Filter", yearFilter === "all" ? "All Years" : yearFilter],
                    ["Section Filter", sectionFilter === "all" ? "All Sections" : sectionFilter],
                    ["Total Students", stats.total],
                    ["Present", stats.present],
                    ["Late", stats.late],
                    ["Absent", stats.absent],
                    ["Attendance Rate", `${stats.rate}%`],
                ]
            }
        ];

        if (selectedEvent) {
            sections.push({
                title: "Event Details",
                rows: [
                    ["Event Name", selectedEvent.name],
                    ["Date", selectedEvent.date],
                    ["Time", selectedEvent.time],
                    ["Location", selectedEvent.location],
                ]
            });
        }

        sections.push({
            title: "Attendance Data",
            headers: ["Student ID", "Full Name", "Course", "Year Level", "Section", "Gender", "Status", "Time"],
            rows: sortedRows.map((r) => [
                r.studentId, r.name, r.course, r.yearLevel, r.section, r.gender, r.status, r.time,
            ])
        });

        const fileName = `AttendWise_Report_${eventLabel.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
        exportToCsv(fileName, sections);
        toast.success("Enhanced report exported as CSV");
    };

    const handlePrint = () => {
        window.print();
    };

    // ── Loading state ──────────────────────────────────────────────────────────
    if (isLoading) {
        return (
        <DashboardLayout role="admin" adminRole={adminRole}>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent mx-auto mb-4" />
                        <p className="text-muted-foreground">Loading report data...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout role="admin" adminRole={adminRole}>
            {/* Custom Print Stylesheet */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    /* Hide non-printable items */
                    aside, header, nav, button, .no-print, [role="navigation"] {
                        display: none !important;
                    }
                    
                    /* Expand main container to page boundaries */
                    body, main, #root, .flex-1, .min-h-screen {
                        width: 100% !important;
                        max-width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        background: white !important;
                        color: black !important;
                        box-shadow: none !important;
                        min-height: auto !important;
                        display: block !important;
                    }

                    main {
                        padding: 10mm 15mm !important;
                    }

                    /* Override layouts */
                    .grid {
                        display: block !important;
                        width: 100% !important;
                    }

                    /* Formatting cards for printing */
                    .shadow-card {
                        border: 1px solid #e2e8f0 !important;
                        box-shadow: none !important;
                        margin-bottom: 25px !important;
                        page-break-inside: avoid !important;
                        border-radius: 8px !important;
                        background: white !important;
                    }

                    /* Stat block items */
                    .grid-cols-2 {
                        display: flex !important;
                        flex-wrap: wrap !important;
                        gap: 12px !important;
                        margin-bottom: 25px !important;
                    }
                    .grid-cols-2 > div {
                        flex: 1 1 18% !important;
                        min-width: 125px !important;
                        border: 1px solid #cbd5e1 !important;
                        background: #f8fafc !important;
                        padding: 12px !important;
                        border-radius: 6px !important;
                    }

                    /* Tables */
                    table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }
                    th, td {
                        border: 1px solid #cbd5e1 !important;
                        padding: 6px 12px !important;
                        font-size: 11px !important;
                        color: black !important;
                    }
                    th {
                        background-color: #f1f5f9 !important;
                        font-weight: bold !important;
                    }
                }
            ` }} />

            <div className="max-w-7xl mx-auto space-y-6">
                {/* ── Header ─────────────────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-3">
                            <BarChart3 className="h-7 w-7 text-gold" />
                            Attendance Reports
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            View and export attendance data by event or across all events
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={handlePrint} variant="outline" className="border-border text-foreground hover:bg-muted font-semibold no-print">
                            <Printer className="h-4 w-4 mr-2" /> Print Report
                        </Button>
                        <Button onClick={handleExport} className="bg-gold text-gold-foreground hover:bg-gold/90 font-semibold no-print">
                            <FileSpreadsheet className="h-4 w-4 mr-2" /> Export CSV
                        </Button>
                    </div>
                </div>

                {/* ── Filters row ────────────────────────────────────────────────── */}
                <Card className="shadow-card no-print">
                    <CardContent className="p-4">
                        <div className="flex flex-wrap gap-3 items-end">
                            {/* Event selector */}
                            <div className="flex-1 min-w-[200px] space-y-1">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> Event
                                </label>
                                <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select event" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Events</SelectItem>
                                        {events.map((e) => (
                                            <SelectItem key={e.id} value={e.id}>
                                                {e.name} — {e.date}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Course filter */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                    <Filter className="h-3 w-3" /> Course
                                </label>
                                <Select value={courseFilter} onValueChange={setCourseFilter}>
                                    <SelectTrigger className="w-40">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {COURSES.map((c) => (
                                            <SelectItem key={c} value={c}>{c === "all" ? "All Courses" : c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Year Level filter */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                    <Filter className="h-3 w-3" /> Year
                                </label>
                                <Select value={yearFilter} onValueChange={setYearFilter}>
                                    <SelectTrigger className="w-36">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Years</SelectItem>
                                        <SelectItem value="1st Year">1st Year</SelectItem>
                                        <SelectItem value="2nd Year">2nd Year</SelectItem>
                                        <SelectItem value="3rd Year">3rd Year</SelectItem>
                                        <SelectItem value="4th Year">4th Year</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Section filter */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                    <Filter className="h-3 w-3" /> Section
                                </label>
                                <Select value={sectionFilter} onValueChange={setSectionFilter}>
                                    <SelectTrigger className="w-36">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableSections.map((sec) => (
                                            <SelectItem key={sec} value={sec}>
                                                {sec === "all" ? "All Sections" : sec}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Status filter */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-36">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="Present">Present</SelectItem>
                                        <SelectItem value="Late">Late</SelectItem>
                                        <SelectItem value="Absent">Absent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Sort By selector */}
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                    <ArrowUpDown className="h-3 w-3" /> Sort By
                                </label>
                                <div className="flex items-center gap-1">
                                    <Select
                                        value={sortField || "none"}
                                        onValueChange={(val) => {
                                            if (val === "none") {
                                                setSortField(null);
                                            } else {
                                                setSortField(val as "name" | "course" | "yearLevel" | "section");
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="w-36">
                                            <SelectValue placeholder="No Sorting" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">No Sorting</SelectItem>
                                            <SelectItem value="name">Student Name</SelectItem>
                                            <SelectItem value="course">Course</SelectItem>
                                            <SelectItem value="yearLevel">Year Level</SelectItem>
                                            <SelectItem value="section">Section</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {sortField && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9 shrink-0"
                                            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                                            title={`Sort direction: ${sortOrder === "asc" ? "Ascending" : "Descending"}`}
                                        >
                                            {sortOrder === "asc" ? (
                                                <ArrowUp className="h-4 w-4 text-gold" />
                                            ) : (
                                                <ArrowDown className="h-4 w-4 text-gold" />
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {/* Search */}
                            <div className="flex-1 min-w-[180px] space-y-1">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Search</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Name, ID or section…"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                        </div>

                        {selectedEvent && (
                            <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-4 text-sm text-muted-foreground">
                                <span><strong className="text-foreground">{selectedEvent.name}</strong></span>
                                <span>📅 {selectedEvent.date}</span>
                                <span>🕐 {selectedEvent.time}</span>
                                <span>📍 {selectedEvent.location}</span>
                                <Badge variant="outline" className="capitalize text-[10px]">{selectedEvent.status}</Badge>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ── Summary Stats ───────────────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {[
                        { label: "Total Students", value: stats.total, icon: Users, color: "text-foreground", bg: "bg-muted" },
                        { label: "Present", value: stats.present, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
                        { label: "Late", value: stats.late, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50" },
                        { label: "Absent", value: stats.absent, icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
                        { label: "Attendance Rate", value: `${stats.rate}%`, icon: BarChart3, color: "text-gold", bg: "bg-gold/10" },
                    ].map((s) => (
                        <Card key={s.label} className="shadow-card">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                                    <s.icon className={`h-5 w-5 ${s.color}`} />
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-foreground leading-tight">{s.value}</p>
                                    <p className="text-xs text-muted-foreground">{s.label}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* ── Charts ──────────────────────────────────────────────────────── */}
                <div className="grid lg:grid-cols-5 gap-6">
                    {/* Pie chart */}
                    <Card className="lg:col-span-2 shadow-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-sans">Attendance Overview</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {stats.total === 0 ? (
                                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                                            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v: number) => [`${v} students`]} />
                                        <Legend iconType="circle" />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>

                    {/* Bar chart by section */}
                    <Card className="lg:col-span-3 shadow-card">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-sans">Attendance by Section</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {sectionData.length === 0 ? (
                                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={Math.max(220, sectionData.length * 36)}>
                                    <BarChart data={sectionData} layout="vertical" margin={{ left: 8 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,15%,88%)" />
                                        <XAxis type="number" tick={{ fontSize: 11 }} />
                                        <YAxis dataKey="section" type="category" tick={{ fontSize: 11 }} width={80} />
                                        <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.1)" }} itemStyle={{ fontSize: "11px" }} />
                                        <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                                        <Bar dataKey="present" fill={BAR_COLORS.present} name="Present" radius={[0, 3, 3, 0]} />
                                        <Bar dataKey="late" fill={BAR_COLORS.late} name="Late" radius={[0, 3, 3, 0]} />
                                        <Bar dataKey="absent" fill={BAR_COLORS.absent} name="Absent" radius={[0, 3, 3, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ── Student Table ────────────────────────────────────────────────── */}
                <Card className="shadow-card">
                    <CardHeader className="pb-3 px-6">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-sans">
                                Student Records
                                <span className="ml-2 text-sm font-normal text-muted-foreground">
                                    ({filteredRows.length} of {studentRows.length})
                                </span>
                            </CardTitle>
                            <Button variant="outline" size="sm" onClick={handleExport}>
                                <Download className="h-3.5 w-3.5 mr-1.5" /> Download
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="px-6">Student ID</TableHead>
                                        <TableHead 
                                            className="cursor-pointer hover:bg-muted/80 transition-colors select-none"
                                            onClick={() => handleSort("name")}
                                        >
                                            <div className="flex items-center gap-1">
                                                Name
                                                {sortField === "name" ? (
                                                    sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-gold" /> : <ArrowDown className="h-3.5 w-3.5 text-gold" />
                                                ) : (
                                                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
                                                )}
                                            </div>
                                        </TableHead>
                                        <TableHead 
                                            className="cursor-pointer hover:bg-muted/80 transition-colors select-none"
                                            onClick={() => handleSort("course")}
                                        >
                                            <div className="flex items-center gap-1">
                                                Course
                                                {sortField === "course" ? (
                                                    sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-gold" /> : <ArrowDown className="h-3.5 w-3.5 text-gold" />
                                                ) : (
                                                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
                                                )}
                                            </div>
                                        </TableHead>
                                        <TableHead 
                                            className="cursor-pointer hover:bg-muted/80 transition-colors select-none"
                                            onClick={() => handleSort("yearLevel")}
                                        >
                                            <div className="flex items-center gap-1">
                                                Year
                                                {sortField === "yearLevel" ? (
                                                    sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-gold" /> : <ArrowDown className="h-3.5 w-3.5 text-gold" />
                                                ) : (
                                                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
                                                )}
                                            </div>
                                        </TableHead>
                                        <TableHead 
                                            className="cursor-pointer hover:bg-muted/80 transition-colors select-none"
                                            onClick={() => handleSort("section")}
                                        >
                                            <div className="flex items-center gap-1">
                                                Section
                                                {sortField === "section" ? (
                                                    sortOrder === "asc" ? <ArrowUp className="h-3.5 w-3.5 text-gold" /> : <ArrowDown className="h-3.5 w-3.5 text-gold" />
                                                ) : (
                                                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
                                                )}
                                            </div>
                                        </TableHead>
                                        <TableHead>Gender</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedRows.length > 0 ? (
                                        sortedRows.map((row) => (
                                            <TableRow key={row.studentId} className="hover:bg-muted/30 transition-colors">
                                                <TableCell className="px-6 font-mono text-sm text-gold">{row.studentId}</TableCell>
                                                <TableCell className="font-semibold">{row.name}</TableCell>
                                                <TableCell className="text-sm">{row.course}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{row.yearLevel}</TableCell>
                                                <TableCell className="text-sm">{row.section}</TableCell>
                                                <TableCell>
                                                    {row.gender ? (
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.gender === "Male" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"}`}>
                                                            {row.gender.toUpperCase()}
                                                        </span>
                                                    ) : "—"}
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[row.status]}`}>
                                                        {row.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">{row.time}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                                No records match your filters.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default AdminReports;
