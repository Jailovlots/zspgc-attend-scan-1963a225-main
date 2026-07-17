import { useState, useMemo, useEffect } from "react";
import { Users, Search, Plus, Edit2, Trash2, UserCheck, UserMinus, MoreHorizontal, Filter, Upload, Trash, FileSpreadsheet, Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import DashboardLayout from "@/components/DashboardLayout";
import { getAllStudents, saveUser, deleteUser, StudentUser, getCourseSections, updateStudent, getSession, getQualifiedStudents, importQualifiedStudents, deleteQualifiedStudent, clearQualifiedStudents, QualifiedStudent } from "@/lib/auth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";

const AdminStudents = () => {
    const navigate = useNavigate();
    const session = getSession();
    const adminRole = session?.adminRole;
    const [students, setStudents] = useState<StudentUser[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [courseSections, setCourseSections] = useState<Record<string, Record<string, string[]>>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const COURSES = useMemo(() => Object.keys(courseSections).sort(), [courseSections]);
    const [courseFilter, setCourseFilter] = useState("all");
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingStudent, setEditingStudent] = useState<StudentUser | null>(null);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    // Qualified Students State
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
    const [qualifiedStudents, setQualifiedStudents] = useState<QualifiedStudent[]>([]);
    const [qualifiedSearchQuery, setQualifiedSearchQuery] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    const [pasteData, setPasteData] = useState("");
    const [parsedData, setParsedData] = useState<QualifiedStudent[]>([]);

    // Form State
    const [formData, setFormData] = useState<Partial<StudentUser>>({
        studentId: "",
        firstName: "",
        lastName: "",
        email: "",
        course: "",
        yearLevel: "",
        section: "",
        gender: "Male",
        role: "student",
    });

    const loadQualifiedStudents = async () => {
        try {
            const data = await getQualifiedStudents();
            setQualifiedStudents(data);
        } catch (err) {
            toast.error("Failed to load qualified student list");
        }
    };

    const parseRawRows = (rows: any[][]): QualifiedStudent[] => {
        if (!rows || rows.length === 0) return [];

        let studentIdColIndex = -1;
        let nameColIndex = -1;
        let firstNameColIndex = -1;
        let lastNameColIndex = -1;
        let headerRowIndex = -1;

        // 1. Scan the first 5 rows to find header columns matching keywords
        for (let r = 0; r < Math.min(rows.length, 5); r++) {
            const row = rows[r];
            if (!row) continue;

            let idIdx = -1;
            let nameIdx = -1;
            let firstIdx = -1;
            let lastIdx = -1;

            for (let c = 0; c < row.length; c++) {
                const val = String(row[c] ?? "").trim().toLowerCase();

                const isIdHeader =
                    val.includes("student number") ||
                    val.includes("student_number") ||
                    val.includes("student id") ||
                    val.includes("studentid") ||
                    val.includes("stud id") ||
                    val.includes("id number") ||
                    val.includes("id no") ||
                    val.includes("id_no") ||
                    val.includes("stud no") ||
                    val.includes("student no") ||
                    val === "id";

                const isFullNameHeader =
                    val.includes("student name") ||
                    val.includes("student_name") ||
                    val.includes("full name") ||
                    val.includes("fullname") ||
                    val.includes("name of student") ||
                    val === "name";

                // Detect split columns
                const isFirstNameHeader =
                    val === "first name" ||
                    val === "firstname" ||
                    val === "first_name" ||
                    val === "given name" ||
                    val === "givenname";

                const isLastNameHeader =
                    val === "last name" ||
                    val === "lastname" ||
                    val === "last_name" ||
                    val === "surname" ||
                    val === "family name" ||
                    val === "familyname";

                if (isIdHeader) idIdx = c;
                else if (isFullNameHeader) nameIdx = c;
                else if (isFirstNameHeader) firstIdx = c;
                else if (isLastNameHeader) lastIdx = c;
            }

            const hasId = idIdx !== -1;
            const hasFullName = nameIdx !== -1;
            const hasSplitName = firstIdx !== -1 || lastIdx !== -1;

            if (hasId && (hasFullName || hasSplitName)) {
                studentIdColIndex = idIdx;
                nameColIndex = hasFullName ? nameIdx : -1;
                firstNameColIndex = firstIdx;
                lastNameColIndex = lastIdx;
                headerRowIndex = r;
                break;
            }
        }

        // 2. Heuristics fallback if header row wasn't found
        if (headerRowIndex === -1) {
            let idVotes: Record<number, number> = {};
            let nameVotes: Record<number, number> = {};
            let serialColumns = new Set<number>();
            let dataRowsCount = 0;

            for (let r = 0; r < Math.min(rows.length, 10); r++) {
                const row = rows[r];
                if (!row || row.length < 2) continue;
                const firstVal = String(row[0] ?? "").trim().toLowerCase();
                if (firstVal === "student id" || firstVal === "id" || firstVal === "no" || firstVal === "no.") continue;

                dataRowsCount++;
                for (let c = 0; c < row.length; c++) {
                    const val = String(row[c] ?? "").trim();
                    if (!val) continue;
                    const valLower = val.toLowerCase();
                    const hasSpaces = val.includes(" ");
                    const isNumberOnly = /^\d+$/.test(val);
                    const isSmallSerial = isNumberOnly && Number(val) < 2000;
                    if (isSmallSerial) serialColumns.add(c);
                    const isGender = valLower === "male" || valLower === "female" || valLower === "m" || valLower === "f";
                    const hasDigit = /\d/.test(val);
                    const isLikelyStudentId = !hasSpaces && !isSmallSerial && !isGender && hasDigit && val.length >= 4 && val.length <= 20;
                    if (isLikelyStudentId) idVotes[c] = (idVotes[c] || 0) + 1;
                    const hasLetters = /[a-zA-Z]/.test(val);
                    const isDate = /\d{4}-\d{2}-\d{2}/.test(val) || val.includes("/");
                    const isLikelyName = hasLetters && !isGender && !isDate && !isSmallSerial && val.length >= 3;
                    if (isLikelyName) nameVotes[c] = (nameVotes[c] || 0) + 1;
                }
            }

            if (dataRowsCount > 0) {
                let maxIdVotes = 0;
                let guessedIdCol = -1;
                for (const colStr in idVotes) {
                    const col = Number(colStr);
                    if (!serialColumns.has(col) && idVotes[col] > maxIdVotes) {
                        maxIdVotes = idVotes[col];
                        guessedIdCol = col;
                    }
                }
                let maxNameVotes = 0;
                let guessedNameCol = -1;
                for (const colStr in nameVotes) {
                    const col = Number(colStr);
                    if (col !== guessedIdCol && !serialColumns.has(col) && nameVotes[col] > maxNameVotes) {
                        maxNameVotes = nameVotes[col];
                        guessedNameCol = col;
                    }
                }
                let maxSecondNameVotes = 0;
                let guessedSecondNameCol = -1;
                for (const colStr in nameVotes) {
                    const col = Number(colStr);
                    if (col !== guessedIdCol && col !== guessedNameCol && !serialColumns.has(col) && nameVotes[col] > maxSecondNameVotes) {
                        maxSecondNameVotes = nameVotes[col];
                        guessedSecondNameCol = col;
                    }
                }
                // Fallback: pick first non-serial column for ID
                if (guessedIdCol === -1) {
                    for (let c = 0; c < (rows[0]?.length ?? 0); c++) {
                        if (!serialColumns.has(c)) { guessedIdCol = c; break; }
                    }
                }
                // Fallback: pick next non-serial column for name
                if (guessedNameCol === -1) {
                    for (let c = 0; c < (rows[0]?.length ?? 0); c++) {
                        if (!serialColumns.has(c) && c !== guessedIdCol) { guessedNameCol = c; break; }
                    }
                }
                studentIdColIndex = guessedIdCol;
                if (guessedSecondNameCol !== -1) {
                    lastNameColIndex = Math.min(guessedNameCol, guessedSecondNameCol);
                    firstNameColIndex = Math.max(guessedNameCol, guessedSecondNameCol);
                } else {
                    nameColIndex = guessedNameCol;
                }
            }
        }

        // 3. Extract data using detected column indices
        const result: QualifiedStudent[] = [];
        for (let r = 0; r < rows.length; r++) {
            if (r === headerRowIndex) continue;
            const row = rows[r];
            if (!row) continue;

            const studentId = studentIdColIndex !== -1 ? String(row[studentIdColIndex] ?? "").trim() : "";
            if (!studentId) continue;

            // Build name: prefer full-name column, else join first+last.
            // If firstNameColIndex is present, we combine first and last names even if nameColIndex is also present (since nameColIndex might only contain the last name).
            let name = "";
            const fn = firstNameColIndex !== -1 ? String(row[firstNameColIndex] ?? "").trim() : "";
            const ln = lastNameColIndex !== -1 ? String(row[lastNameColIndex] ?? "").trim() : 
                       (nameColIndex !== -1 && nameColIndex !== firstNameColIndex ? String(row[nameColIndex] ?? "").trim() : "");

            if (ln && fn) {
                name = `${ln}, ${fn}`;
            } else if (nameColIndex !== -1) {
                name = String(row[nameColIndex] ?? "").trim();
            } else {
                name = ln || fn;
            }

            if (!name) continue;

            // Skip header rows
            const idLower = studentId.toLowerCase();
            if (
                idLower === "student id" || idLower === "studentid" ||
                idLower === "student number" || idLower === "id" ||
                idLower === "no" || idLower === "no."
            ) continue;

            result.push({ studentId, name });
        }

        return result;
    };

    const parsePastedData = (text: string): QualifiedStudent[] => {
        // Normalise line endings (\r\n, \r, \n → \n) then split
        const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
        const rows: string[][] = [];
        
        for (let line of lines) {
            // Strip null bytes that can appear in mis-decoded UTF-16 files
            line = line.replace(/\0/g, "").trim();
            if (!line) continue;
            
            // Try splitting by tab first (Excel copy-paste), then comma (CSV)
            let parts = line.split("\t");
            if (parts.length < 2) {
                parts = line.split(",");
            }
            rows.push(parts);
        }
        
        return parseRawRows(rows);
    };

    const handlePasteChange = (val: string) => {
        setPasteData(val);
        const parsed = parsePastedData(val);
        setParsedData(parsed);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        // Reset the uploader input
        e.target.value = "";

        const reader = new FileReader();
        reader.onload = (event) => {
            const buffer = event.target?.result as ArrayBuffer;
            if (!buffer) return;

            try {
                // Read sheet data using SheetJS
                const workbook = XLSX.read(buffer, { type: "array" });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

                const parsed = parseRawRows(rows);
                if (parsed.length > 0) {
                    setParsedData(parsed);
                    toast.success(`Successfully parsed ${parsed.length} student records from file.`);
                } else {
                    toast.error("No valid records found. Ensure the file has columns for Student ID and Name.");
                }
            } catch (err) {
                console.error("File upload parse error:", err);
                toast.error("Failed to read file. Please make sure it is a valid Excel or CSV file.");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleImportConfirm = async () => {
        if (parsedData.length === 0) {
            toast.error("No student records to import.");
            return;
        }
        
        setIsImporting(true);
        try {
            const res = await importQualifiedStudents(parsedData);
            if (res.ok) {
                toast.success(`Successfully imported ${res.count} qualified students!`);
                setPasteData("");
                setParsedData([]);
                await loadQualifiedStudents();
            } else {
                toast.error(res.error || "Failed to import qualified student IDs");
            }
        } catch (err) {
            toast.error("An error occurred during import.");
        } finally {
            setIsImporting(false);
        }
    };

    const handleDeleteQualified = async (studentId: string) => {
        try {
            const ok = await deleteQualifiedStudent(studentId);
            if (ok) {
                toast.success(`Removed Student ID ${studentId} from qualified list.`);
                await loadQualifiedStudents();
            } else {
                toast.error("Failed to remove student ID.");
            }
        } catch (err) {
            toast.error("An error occurred.");
        }
    };

    const handleClearQualified = async () => {
        try {
            const ok = await clearQualifiedStudents();
            if (ok) {
                toast.success("Successfully cleared all qualified student records.");
                await loadQualifiedStudents();
            } else {
                toast.error("Failed to clear qualified student records.");
            }
        } catch (err) {
            toast.error("An error occurred.");
        } finally {
            setIsClearConfirmOpen(false);
        }
    };

    const filteredQualifiedStudents = useMemo(() => {
        return qualifiedStudents.filter((s) => {
            return (
                (s.studentId ?? "").toLowerCase().includes(qualifiedSearchQuery.toLowerCase()) ||
                (s.name ?? "").toLowerCase().includes(qualifiedSearchQuery.toLowerCase())
            );
        });
    }, [qualifiedStudents, qualifiedSearchQuery]);

    useEffect(() => {
        if (!session || session.role !== "admin") {
            toast.error("Please log in as an admin to access this page");
            navigate("/login");
            return;
        }

        if (session.adminRole === "officer") {
            toast.error("You do not have permission to access the Students page");
            navigate("/admin");
            return;
        }

        const init = async () => {
            setIsLoading(true);
            try {
                const [data, sections] = await Promise.all([
                    getAllStudents(),
                    getCourseSections()
                ]);
                setStudents(data);
                setCourseSections(sections);
                await loadQualifiedStudents();
            } catch (err) {
                toast.error("Failed to load student data");
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, []);

    const loadStudents = async () => {
        const data = await getAllStudents();
        setStudents(data);
    };

    const filteredStudents = useMemo(() => {
        return students.filter((s) => {
            const matchesSearch =
                (s.firstName ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.lastName ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.studentId ?? "").includes(searchQuery);
            const matchesCourse = courseFilter === "all" || s.course === courseFilter;
            return matchesSearch && matchesCourse;
        });
    }, [students, searchQuery, courseFilter]);

    const handleAddClick = () => {
        setIsEditMode(false);
        setEditingStudent(null);
        setFormData({
            studentId: "",
            firstName: "",
            lastName: "",
            email: "",
            course: "",
            yearLevel: "",
            section: "",
            gender: "Male",
            role: "student",
        });
        setIsAddDialogOpen(true);
    };

    const handleEditClick = (student: StudentUser) => {
        setIsEditMode(true);
        setEditingStudent(student);
        setFormData({ ...student });
        setIsAddDialogOpen(true);
    };

    const handleDeleteClick = (studentId: string) => {
        setDeleteTargetId(studentId);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId) return;
        const success = await deleteUser(deleteTargetId);
        if (success) {
            await loadStudents();
            toast.success("Student deleted successfully");
        } else {
            toast.error("Failed to delete student");
        }
        setDeleteTargetId(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.studentId || !formData.firstName || !formData.lastName || !formData.email) {
            toast.error("Please fill in all required fields");
            return;
        }

        setIsSaving(true);
        try {
            if (isEditMode && editingStudent) {
                // Merge original student data with updated formData so no fields are lost
                const merged: StudentUser = { ...editingStudent, ...formData } as StudentUser;
                const result = await updateStudent(editingStudent.studentId, merged);
                if (result.ok) {
                    await loadStudents();
                    setIsAddDialogOpen(false);
                    toast.success("Student updated successfully");
                } else {
                    toast.error(result.error || "Failed to update student");
                }
            } else {
                const result = await saveUser({ ...formData, bypassQualification: true } as StudentUser);
                if (result.ok) {
                    await loadStudents();
                    setIsAddDialogOpen(false);
                    toast.success("Student added successfully");
                } else {
                    toast.error(result.error || "Failed to add student (ID may already exist)");
                }
            }
        } catch (err) {
            toast.error("Operation failed. Try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const updateForm = (key: keyof StudentUser, value: any) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const availableSections = useMemo(() => {
        if (formData.course && formData.yearLevel) {
            return courseSections[formData.course]?.[formData.yearLevel] || [];
        }
        return [];
    }, [formData.course, formData.yearLevel, courseSections]);

    return (
        <DashboardLayout role="admin" adminRole={adminRole}>
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-3">
                            <Users className="h-7 w-7 text-gold" />
                            Student Management
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">View and manage all registered students</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button onClick={() => setIsImportDialogOpen(true)} variant="outline" className="border-gold text-gold hover:bg-gold/10 hover:text-gold">
                            <Upload className="h-4 w-4 mr-2" /> Import IDs
                        </Button>
                        <Button onClick={handleAddClick} className="bg-gold text-gold-foreground hover:bg-gold/90">
                            <Plus className="h-4 w-4 mr-2" /> Add Student
                        </Button>
                    </div>
                </div>

                <Card className="shadow-card">
                    <CardHeader className="pb-3 px-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name or ID..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-muted-foreground" />
                                <Select value={courseFilter} onValueChange={setCourseFilter}>
                                    <SelectTrigger className="w-40">
                                        <SelectValue placeholder="All Courses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Courses</SelectItem>
                                        {COURSES.map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="px-6">Student ID</TableHead>
                                    <TableHead>Last Name</TableHead>
                                    <TableHead>First Name</TableHead>
                                    <TableHead>Course</TableHead>
                                    <TableHead>Year & Section</TableHead>
                                    <TableHead>Gender</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead className="text-right px-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStudents.length > 0 ? (
                                    filteredStudents.map((student) => (
                                        <TableRow key={student.studentId} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="px-6 font-mono font-medium text-sm text-gold">{student.studentId}</TableCell>
                                            <TableCell className="font-semibold capitalize">{student.lastName}</TableCell>
                                            <TableCell className="font-semibold capitalize">{student.firstName}</TableCell>
                                            <TableCell>{student.course}</TableCell>
                                            <TableCell className="text-muted-foreground">{student.yearLevel} • {student.section}</TableCell>
                                            <TableCell>
                                                {student.gender ? (
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${student.gender === 'Male' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                                                        {student.gender.toUpperCase()}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground italic text-[10px]">NOT SET</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{student.email}</TableCell>
                                            <TableCell className="text-right px-6">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleEditClick(student)}>
                                                            <Edit2 className="h-4 w-4 mr-2" /> Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => handleDeleteClick(student.studentId)}
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            No students found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Add/Edit Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{isEditMode ? "Edit Student Details" : "Add New Student"}</DialogTitle>
                        <DialogDescription>
                            {isEditMode
                                ? "Update information for this student record. Changing the Student ID will reassign all attendance records."
                                : "Enter the details to create a new student record."}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="studentId">Student ID</Label>
                                <Input
                                    id="studentId"
                                    value={formData.studentId}
                                    onChange={(e) => updateForm("studentId", e.target.value)}
                                    placeholder="2024-00001"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => updateForm("email", e.target.value)}
                                    placeholder="name@zdspgc.edu.ph"
                                    required
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="lastName">Last Name</Label>
                                <Input
                                    id="lastName"
                                    value={formData.lastName}
                                    onChange={(e) => updateForm("lastName", e.target.value)}
                                    placeholder="Dela Cruz"
                                    className="capitalize"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="firstName">First Name</Label>
                                <Input
                                    id="firstName"
                                    value={formData.firstName}
                                    onChange={(e) => updateForm("firstName", e.target.value)}
                                    placeholder="Juan"
                                    className="capitalize"
                                    required
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <Label>Course</Label>
                                <Select value={formData.course} onValueChange={(v) => updateForm("course", v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Course" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {COURSES.map(c => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Year Level</Label>
                                <Select value={formData.yearLevel} onValueChange={(v) => updateForm("yearLevel", v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1st Year">1st Year</SelectItem>
                                        <SelectItem value="2nd Year">2nd Year</SelectItem>
                                        <SelectItem value="3rd Year">3rd Year</SelectItem>
                                        <SelectItem value="4th Year">4th Year</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Section</Label>
                                <Select
                                    value={formData.section}
                                    onValueChange={(v) => updateForm("section", v)}
                                    disabled={!formData.course || !formData.yearLevel}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Section" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableSections.map((sec) => (
                                            <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Gender</Label>
                                <Select value={formData.gender} onValueChange={(v) => updateForm("gender", v as any)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Gender" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Male">Male</SelectItem>
                                        <SelectItem value="Female">Female</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSaving} className="bg-gold text-gold-foreground hover:bg-gold/90">
                                {isSaving ? "Saving..." : (isEditMode ? "Save Changes" : "Create Student")}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteTargetId} onOpenChange={(o) => !o && setDeleteTargetId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Student Record?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove the student and their access to the app. Existing attendance records will remain but will no longer link to a profile.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Import & Manage Qualified Student IDs Dialog */}
            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
                    <DialogHeader className="pb-2">
                        <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-gold" />
                            Qualified Student IDs
                        </DialogTitle>
                        <DialogDescription>
                            Import and manage student IDs authorized to register accounts. Students cannot sign up if their ID and name do not match this list.
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="import" className="flex-1 flex flex-col overflow-hidden">
                        <TabsList className="grid w-full grid-cols-2 mb-4">
                            <TabsTrigger value="import" className="flex items-center gap-2">
                                <Upload className="h-4 w-4" /> Import list
                            </TabsTrigger>
                            <TabsTrigger value="manage" className="flex items-center gap-2" onClick={loadQualifiedStudents}>
                                <Users className="h-4 w-4" /> Current list ({qualifiedStudents.length})
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="import" className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
                            <div className="bg-muted/40 border rounded-lg p-3 text-xs flex gap-2.5 items-start">
                                <Info className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold block mb-0.5">Import Format Requirements:</span>
                                    Provide records with two columns: <strong className="text-foreground">Student ID</strong> and <strong className="text-foreground">Student Name</strong>. 
                                    Supported file types: <strong className="text-foreground">.xlsx</strong>, <strong className="text-foreground">.xls</strong>, and <strong className="text-foreground">.csv</strong>. Casing will be normalized automatically.
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Option A: Upload File</Label>
                                    <div className="border border-dashed border-muted-foreground/30 hover:border-gold/50 rounded-lg p-4 transition-colors flex flex-col items-center justify-center gap-2 text-center bg-card">
                                        <Upload className="h-8 w-8 text-muted-foreground/60" />
                                        <div className="text-xs">
                                            <label htmlFor="csv-upload" className="cursor-pointer font-semibold text-gold hover:underline">
                                                Click to upload Excel or CSV
                                            </label>
                                            <p className="text-muted-foreground mt-0.5">.xlsx &bull; .xls &bull; .csv</p>
                                        </div>
                                        <input 
                                            id="csv-upload" 
                                            type="file" 
                                            accept=".xlsx,.xls,.csv" 
                                            className="hidden" 
                                            onChange={handleFileUpload} 
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Option B: Paste Records</Label>
                                    <Textarea
                                        placeholder="2024-00001, Juan Dela Cruz&#10;2024-00002, Maria Santos"
                                        value={pasteData}
                                        onChange={(e) => handlePasteChange(e.target.value)}
                                        className="h-28 text-xs font-mono"
                                    />
                                </div>
                            </div>

                            {parsedData.length > 0 && (
                                <div className="space-y-2 flex-1 flex flex-col min-h-[180px] overflow-hidden border rounded-lg bg-card">
                                    <div className="px-3 py-2 bg-muted/50 border-b flex justify-between items-center">
                                        <span className="text-xs font-bold text-foreground">Parsed Preview ({parsedData.length} records)</span>
                                        <Button variant="ghost" onClick={() => { setPasteData(""); setParsedData([]); }} className="h-6 text-[10px] text-muted-foreground hover:text-destructive px-2">
                                            Clear
                                        </Button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto">
                                        <Table>
                                            <TableHeader className="bg-muted/30 sticky top-0">
                                                <TableRow>
                                                    <TableHead className="py-1.5 px-3 text-xs">Student ID</TableHead>
                                                    <TableHead className="py-1.5 px-3 text-xs">Name</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {parsedData.map((row, idx) => (
                                                    <TableRow key={idx} className="hover:bg-muted/10">
                                                        <TableCell className="py-1 px-3 font-mono text-xs">{row.studentId}</TableCell>
                                                        <TableCell className="py-1 px-3 text-xs">{row.name}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-2 border-t mt-auto">
                                <Button type="button" variant="outline" size="sm" onClick={() => setIsImportDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button 
                                    type="button" 
                                    disabled={isImporting || parsedData.length === 0} 
                                    onClick={handleImportConfirm}
                                    className="bg-gold text-gold-foreground hover:bg-gold/90"
                                    size="sm"
                                >
                                    {isImporting ? "Importing..." : `Import (${parsedData.length}) Records`}
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="manage" className="flex-1 flex flex-col gap-3 overflow-hidden">
                            <div className="flex gap-2 items-center">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Search qualified student list..."
                                        value={qualifiedSearchQuery}
                                        onChange={(e) => setQualifiedSearchQuery(e.target.value)}
                                        className="pl-8 h-8 text-xs"
                                    />
                                </div>
                                {qualifiedStudents.length > 0 && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsClearConfirmOpen(true)}
                                        className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center gap-1.5 shrink-0"
                                    >
                                        <Trash className="h-3.5 w-3.5" />
                                        Clear List
                                    </Button>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto border rounded-lg bg-card">
                                <Table>
                                    <TableHeader className="bg-muted/40 sticky top-0">
                                        <TableRow>
                                            <TableHead className="h-8 px-4 text-xs">Student ID</TableHead>
                                            <TableHead className="h-8 px-4 text-xs">Name</TableHead>
                                            <TableHead className="h-8 px-4 text-right text-xs">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredQualifiedStudents.length > 0 ? (
                                            filteredQualifiedStudents.map((row) => (
                                                <TableRow key={row.studentId} className="hover:bg-muted/20">
                                                    <TableCell className="py-1.5 px-4 font-mono text-xs">{row.studentId}</TableCell>
                                                    <TableCell className="py-1.5 px-4 text-xs">{row.name}</TableCell>
                                                    <TableCell className="py-1.5 px-4 text-right">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleDeleteQualified(row.studentId)}
                                                        >
                                                            <Trash className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-xs italic">
                                                    No qualified student records found.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>
            {/* Clear All Confirmation Dialog */}
            <AlertDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete all {qualifiedStudents.length} student records from the qualified list.
                            Authorized students who have not yet registered will not be able to sign up until you upload a new list.
                            Registered accounts will not be affected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearQualified} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Clear All Records
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DashboardLayout>
    );
};

export default AdminStudents;
