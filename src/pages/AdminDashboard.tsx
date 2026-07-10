import { useState, useMemo, useEffect } from "react";
import { Users, CheckCircle2, Clock, XCircle, Camera, Download, Search, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { getAllStudents, getAttendanceRecords, getCourseSections, getSession, type AttendanceRecord, type StudentUser } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { exportToCsv } from "@/lib/exportUtils";
import { toast } from "sonner";

const getTodayDateString = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

interface SectionEntry {
  section: string;
  course: string;
  year: string;
  present: number;
  late: number;
  absent: number;
  malePresent: number;
  femalePresent: number;
  maleLate: number;
  femaleLate: number;
  maleAbsent: number;
  femaleAbsent: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const session = getSession();
  const adminRole = session?.adminRole;
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [viewMode, setViewMode] = useState<"grouped" | "list">("grouped");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string>("All");
  const [courseSections, setCourseSections] = useState<Record<string, Record<string, string[]>>>({});
  const [registeredUsers, setRegisteredUsers] = useState<StudentUser[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const COURSES = useMemo(() => ["All", ...Object.keys(courseSections).sort()], [courseSections]);
  const todayStr = getTodayDateString();

  useEffect(() => {
    if (!session || session.role !== "admin") {
      toast.error("Please log in as an admin to access this page");
      navigate("/login");
      return;
    }

    const init = async () => {
      setIsLoading(true);
      try {
        const [users, records, sections] = await Promise.all([
          getAllStudents(),
          getAttendanceRecords(),
          getCourseSections()
        ]);

        setRegisteredUsers(users.filter(u => u.role === "student"));
        
        // Filter records by the specific selectedDate (YYYY-MM-DD)
        setAttendanceRecords(records.filter(r => {
          const recordDate = new Date(r.timestamp).toLocaleDateString('en-CA'); // YYYY-MM-DD
          return recordDate === selectedDate;
        }));
        
        setCourseSections(sections);
      } catch (err) {
        console.error("Dashboard data load failed:", err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [selectedDate]);

  // Pre-compute user map for O(1) lookups instead of O(N*M) loops
  const userMap = useMemo(() => {
    const map = new Map<string, StudentUser>();
    registeredUsers.forEach(u => map.set(u.studentId, u));
    return map;
  }, [registeredUsers]);

  // Calculate dynamic section metrics from real users
  const sectionMetrics = useMemo(() => {
    const metrics: Record<string, SectionEntry> = {};

    // Initialize metrics based on registered users to ensure we know the denominator
    registeredUsers.forEach(u => {
      if (!metrics[u.section]) {
        metrics[u.section] = {
          section: u.section,
          course: u.course,
          year: u.yearLevel,
          present: 0,
          late: 0,
          absent: 0,
          malePresent: 0,
          femalePresent: 0,
          maleLate: 0,
          femaleLate: 0,
          maleAbsent: 0,
          femaleAbsent: 0
        };
      }
    });

    // Count scans
    attendanceRecords.forEach(r => {
      const student = userMap.get(r.studentId);
      if (student && metrics[student.section]) {
        if (r.status === "Present") {
          metrics[student.section].present++;
          if (student.gender === "Male") metrics[student.section].malePresent++;
          else metrics[student.section].femalePresent++;
        }
        else if (r.status === "Late") {
          metrics[student.section].late++;
          if (student.gender === "Male") metrics[student.section].maleLate++;
          else metrics[student.section].femaleLate++;
        }
      }
    });

    // Calculate absent per section/gender
    Object.keys(metrics).forEach(s => {
      const sectionStudents = registeredUsers.filter(u => u.section === s);
      const maleTotal = sectionStudents.filter(u => u.gender === "Male").length;
      const femaleTotal = sectionStudents.filter(u => u.gender === "Female").length;

      metrics[s].absent = sectionStudents.length - (metrics[s].present + metrics[s].late);
      metrics[s].maleAbsent = maleTotal - (metrics[s].malePresent + metrics[s].maleLate);
      metrics[s].femaleAbsent = femaleTotal - (metrics[s].femalePresent + metrics[s].femaleLate);
    });

    return Object.values(metrics);
  }, [registeredUsers, attendanceRecords, userMap]);

  const filteredSections = useMemo(
    () => selectedCourse === "All" ? sectionMetrics : sectionMetrics.filter((s) => s.course === selectedCourse),
    [sectionMetrics, selectedCourse]
  );

  const stats = useMemo(() => {
    const present = filteredSections.reduce((sum, s) => sum + s.present, 0);
    const late = filteredSections.reduce((sum, s) => sum + s.late, 0);
    const absent = filteredSections.reduce((sum, s) => sum + s.absent, 0);
    const total = present + late + absent;
    return { total, present, late, absent };
  }, [filteredSections]);

  const pieData = useMemo(() => [
    { name: "Present", value: stats.present, color: "hsl(142, 72%, 40%)" },
    { name: "Late", value: stats.late, color: "hsl(38, 92%, 50%)" },
    { name: "Absent", value: stats.absent, color: "hsl(0, 84%, 60%)" },
  ], [stats]);

  const adminStats = useMemo(() => {
    const totalRegistered = selectedCourse === "All"
      ? registeredUsers.length
      : registeredUsers.filter(u => u.course === selectedCourse).length;

    return [
      { label: "Total Students", value: totalRegistered.toString(), icon: Users, color: "text-foreground" },
      { label: "Present Today", value: stats.present.toString(), icon: CheckCircle2, color: "text-success" },
      { label: "Late Today", value: stats.late.toString(), icon: Clock, color: "text-warning" },
      { label: "Absent Today", value: stats.absent.toString(), icon: XCircle, color: "text-destructive" },
    ];
  }, [stats, registeredUsers, selectedCourse]);

  const genderStats = useMemo(() => {
    const courseUsers = selectedCourse === "All"
      ? registeredUsers
      : registeredUsers.filter(u => u.course === selectedCourse);

    const maleTotal = courseUsers.filter(u => u.gender === "Male").length;
    const femaleTotal = courseUsers.filter(u => u.gender === "Female").length;

    const maleAttended = attendanceRecords.filter(r => {
      const student = userMap.get(r.studentId);
      return student && student.course === (selectedCourse === "All" ? student.course : selectedCourse) && student.gender === "Male";
    }).length;

    const femaleAttended = attendanceRecords.filter(r => {
      const student = userMap.get(r.studentId);
      return student && student.course === (selectedCourse === "All" ? student.course : selectedCourse) && student.gender === "Female";
    }).length;

    return {
      male: { total: maleTotal, attended: maleAttended },
      female: { total: femaleTotal, attended: femaleAttended }
    };
  }, [registeredUsers, attendanceRecords, selectedCourse, userMap]);

  const genderPieData = useMemo(() => [
    { name: "Male", value: genderStats.male.attended, color: "hsl(217, 91%, 60%)" },
    { name: "Female", value: genderStats.female.attended, color: "hsl(330, 81%, 60%)" },
  ], [genderStats]);

  // Group filtered sections by year for display
  const groupedByYear = useMemo(() => {
    const groups: Record<string, SectionEntry[]> = {};
    filteredSections.forEach((s) => {
      const key = selectedCourse === "All" ? `${s.course} — ${s.year}` : s.year;
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return groups;
  }, [filteredSections, selectedCourse]);

  const filteredScans = useMemo(() => {
    let scans = attendanceRecords.map(r => {
      const student = userMap.get(r.studentId);
      return {
        id: r.studentId,
        name: r.name,
        course: student?.course || "N/A",
        year: student?.yearLevel || "N/A",
        section: student?.section || "N/A",
        gender: r.gender,
        time: r.time,
        status: r.status,
        eventName: r.eventName || "General Attendance"
      };
    });

    if (selectedCourse !== "All") {
      scans = scans.filter((s) => s.course === selectedCourse);
    }
    if (statusFilter !== "all") {
      const targetStatus = statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);
      scans = scans.filter((s) => s.status === targetStatus);
    }
    if (searchQuery) {
      scans = scans.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.id.includes(searchQuery)
      );
    }
    return scans;
  }, [attendanceRecords, selectedCourse, searchQuery, statusFilter, userMap]);

  // Group filtered scans by course → year → section
  const groupedScans = useMemo(() => {
    const groups: Record<string, Record<string, Record<string, any[]>>> = {};
    filteredScans.forEach((s) => {
      if (!groups[s.course]) groups[s.course] = {};
      if (!groups[s.course][s.year]) groups[s.course][s.year] = {};
      if (!groups[s.course][s.year][s.section]) groups[s.course][s.year][s.section] = [];
      groups[s.course][s.year][s.section].push(s);
    });
    return groups;
  }, [filteredScans]);

  const handleExport = () => {
    const courseLabel = selectedCourse === "All" ? "All Courses" : selectedCourse;
    const dateLabel = selectedDate;

    const sections = [
      {
        title: `AttendWise Attendance Record`,
        rows: [
          ["Course/Department", courseLabel],
          ["Attendance Date", dateLabel],
          ["Export Generated", new Date().toLocaleString()],
        ]
      },
      {
        title: "Summary Statistics",
        rows: [
          ["Total Students in Filter", stats.total],
          ["Present", stats.present],
          ["Late", stats.late],
          ["Absent", stats.absent],
          ["Attendance Rate", stats.total > 0 ? `${Math.round(((stats.present + stats.late) / stats.total) * 100)}%` : "0%"],
        ]
      },
      {
        title: "Gender Breakdown",
        rows: [
          ["Male (Present/Total)", `${genderStats.male.attended} / ${genderStats.male.total}`],
          ["Female (Present/Total)", `${genderStats.female.attended} / ${genderStats.female.total}`],
        ]
      },
      {
        title: "Detailed Attendance Log",
        headers: ["Student ID", "Full Name", "Course", "Year", "Section", "Gender", "Event", "Status", "Time"],
        rows: filteredScans.map(s => [
          s.id, s.name, s.course, s.year, s.section, s.gender, s.eventName, s.time, s.status
        ])
      }
    ];

    const fileName = `Attendance_Record_${courseLabel.replace(/\s+/g, "_")}_${dateLabel}.csv`;
    exportToCsv(fileName, sections);
    toast.success("Attendance record exported");
  };

  if (isLoading) {
    return (
      <DashboardLayout role="admin" adminRole={adminRole}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard analytics...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin" adminRole={adminRole}>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} — {selectedCourse} Overview
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-background border rounded-lg px-3 py-1 shadow-sm">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent border-none text-sm font-medium focus:ring-0 cursor-pointer"
              />
            </div>
            <div className="h-9 border-r mx-1 hidden sm:block" />
            <Button onClick={() => navigate("/admin/scanner")} className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Camera className="h-4 w-4 mr-2" /> Scan QR
            </Button>
            <Button onClick={handleExport} variant="outline">
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Course Tabs & View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/30 p-2 rounded-xl border">
          <Tabs value={selectedCourse} onValueChange={setSelectedCourse} className="w-full sm:w-auto">
            <TabsList className="bg-transparent">
              {COURSES.map((c) => (
                <TabsTrigger key={c} value={c} className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  {c}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          
          <div className="flex items-center gap-1 bg-background/50 p-1 rounded-lg border shadow-sm">
            <Button 
              variant={viewMode === "grouped" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setViewMode("grouped")}
              className="h-8 gap-2 rounded-md"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="text-xs font-medium">Grouped</span>
            </Button>
            <Button 
              variant={viewMode === "list" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setViewMode("list")}
              className="h-8 gap-2 rounded-md"
            >
              <List className="h-4 w-4" />
              <span className="text-xs font-medium">List View</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {adminStats.map((s) => (
            <Card key={s.label} className="shadow-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <s.icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Gender Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-subtle border-l-4 border-l-blue-500">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-blue-600 font-bold">M</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Male Attendance</p>
                  <p className="text-xl font-bold text-foreground">{genderStats.male.attended} <span className="text-xs font-normal text-muted-foreground">/ {genderStats.male.total} total</span></p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-blue-600">{genderStats.male.total > 0 ? Math.round((genderStats.male.attended / genderStats.male.total) * 100) : 0}%</p>
                <p className="text-[10px] text-muted-foreground uppercase">Participation</p>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-subtle border-l-4 border-l-pink-500">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-pink-100 flex items-center justify-center">
                  <span className="text-pink-600 font-bold">F</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Female Attendance</p>
                  <p className="text-xl font-bold text-foreground">{genderStats.female.attended} <span className="text-xs font-normal text-muted-foreground">/ {genderStats.female.total} total</span></p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-pink-600">{genderStats.female.total > 0 ? Math.round((genderStats.female.attended / genderStats.female.total) * 100) : 0}%</p>
                <p className="text-[10px] text-muted-foreground uppercase">Participation</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-sans">
                {selectedCourse === "All" ? "Today's Overview" : `${selectedCourse} Overview`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-sans">
                Gender Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={genderPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {genderPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-sans">
                {selectedCourse === "All" ? "Attendance by Section" : `${selectedCourse} — Attendance by Section`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(groupedByYear).map(([yearLabel, sections]) => (
                <div key={yearLabel}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{yearLabel}</p>
                  <ResponsiveContainer width="100%" height={Math.max(140, sections.length * 35)}>
                    <BarChart data={sections} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="section" type="category" tick={{ fontSize: 11 }} width={90} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        itemStyle={{ fontSize: '11px', padding: '2px 0' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

                      {/* Male Stack */}
                      <Bar dataKey="malePresent" stackId="male" fill="hsl(217, 91%, 60%)" radius={[0, 0, 0, 0]} name="Male Present" />
                      <Bar dataKey="maleLate" stackId="male" fill="hsl(217, 91%, 75%)" radius={[0, 0, 0, 0]} name="Male Late" />
                      <Bar dataKey="maleAbsent" stackId="male" fill="hsl(217, 91%, 90%)" radius={[0, 3, 3, 0]} name="Male Absent" />

                      {/* Gap - Recharts doesn't handle spacing between stack groups well in vertical layout easily, 
                          but having different stackIds will place them next to each other automatically if we use a grouped layout.
                          Actually, in vertical layout, multiple bars with different stackIds in the same category will be grouped side-by-side. */}

                      {/* Female Stack */}
                      <Bar dataKey="femalePresent" stackId="female" fill="hsl(330, 81%, 60%)" radius={[0, 0, 0, 0]} name="Female Present" />
                      <Bar dataKey="femaleLate" stackId="female" fill="hsl(330, 81%, 75%)" radius={[0, 0, 0, 0]} name="Female Late" />
                      <Bar dataKey="femaleAbsent" stackId="female" fill="hsl(330, 81%, 90%)" radius={[0, 3, 3, 0]} name="Female Absent" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Recent Scans */}
        <Card className="shadow-card">
          <CardHeader className="pb-3 border-b mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-gold" />
                {selectedCourse === "All" ? "Attendance Records" : `${selectedCourse} Attendance Records`}
                <Badge variant="outline" className="ml-2 font-mono font-normal">
                  {new Date(selectedDate).toLocaleDateString()}
                </Badge>
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search student..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full sm:w-56 h-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {viewMode === "grouped" ? (
              Object.entries(groupedScans).map(([course, years]) => (
                <div key={course}>
                  <h3 className="text-sm font-bold text-foreground mb-3">{course}</h3>
                  {Object.entries(years).map(([year, sections]) => (
                    <div key={`${course}-${year}`} className="mb-4 ml-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{year}</p>
                      {Object.entries(sections).map(([section, scans]) => (
                        <div key={section} className="mb-3 ml-2">
                          <p className="text-xs font-medium text-foreground/70 mb-1">📋 {section}</p>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Student ID</TableHead>
                                <TableHead>Name</TableHead>
                                 <TableHead>Gender</TableHead>
                                 <TableHead>Event</TableHead>
                                 <TableHead>Time</TableHead>
                                 <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {scans.map((row) => (
                                <TableRow key={row.id}>
                                  <TableCell className="font-mono text-sm">{row.id}</TableCell>
                                  <TableCell className="font-medium">{row.name}</TableCell>
                                  <TableCell>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.gender === 'Male' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                                      {row.gender?.toUpperCase()}
                                    </span>
                                  </TableCell>
                                   <TableCell>
                                     <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                                       {row.eventName}
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
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[120px]">Student ID</TableHead>
                      <TableHead>Full Name</TableHead>
                       <TableHead>Course & Section</TableHead>
                       <TableHead>Event</TableHead>
                       <TableHead className="w-[100px]">Gender</TableHead>
                       <TableHead className="w-[120px]">Time</TableHead>
                       <TableHead className="w-[100px] text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredScans.length > 0 ? (
                      filteredScans.map((row) => (
                        <TableRow key={row.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-sm font-medium">{row.id}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-semibold text-sm">{row.name}</p>
                              <p className="text-[10px] text-muted-foreground uppercase">{row.year} Year</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <span className="font-bold text-primary">{row.course}</span>
                              <span className="mx-1 text-muted-foreground">•</span>
                               <span className="text-muted-foreground">{row.section}</span>
                             </div>
                           </TableCell>
                           <TableCell>
                             <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                               {row.eventName}
                             </Badge>
                           </TableCell>
                           <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.gender === 'Male' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                              {row.gender?.toUpperCase()}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{row.time}</TableCell>
                          <TableCell className="text-right">
                            <span 
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                row.status === "Present" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                              }`}
                            >
                              {row.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                          No attendance records found for the selected filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
