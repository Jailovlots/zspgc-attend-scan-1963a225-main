import { useState, useMemo, useEffect } from "react";
import { Users, Search, Plus, Edit2, Trash2, UserCheck, UserMinus, MoreHorizontal, Filter } from "lucide-react";
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
import DashboardLayout from "@/components/DashboardLayout";
import { getAllStudents, saveUser, deleteUser, StudentUser, getCourseSections, updateStudent, getSession } from "@/lib/auth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

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

    useEffect(() => {
        if (!session || session.role !== "admin") {
            toast.error("Please log in as an admin to access this page");
            navigate("/login");
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
                const success = await saveUser(formData as StudentUser);
                if (success) {
                    await loadStudents();
                    setIsAddDialogOpen(false);
                    toast.success("Student added successfully");
                } else {
                    toast.error("Failed to add student (ID may already exist)");
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
                    <Button onClick={handleAddClick} className="bg-gold text-gold-foreground hover:bg-gold/90">
                        <Plus className="h-4 w-4 mr-2" /> Add Student
                    </Button>
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
                                    <TableHead>Full Name</TableHead>
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
                                            <TableCell className="font-semibold">{student.firstName} {student.lastName}</TableCell>
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
                                <Label htmlFor="firstName">First Name</Label>
                                <Input
                                    id="firstName"
                                    value={formData.firstName}
                                    onChange={(e) => updateForm("firstName", e.target.value)}
                                    placeholder="Juan"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="lastName">Last Name</Label>
                                <Input
                                    id="lastName"
                                    value={formData.lastName}
                                    onChange={(e) => updateForm("lastName", e.target.value)}
                                    placeholder="Dela Cruz"
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
        </DashboardLayout>
    );
};

export default AdminStudents;
