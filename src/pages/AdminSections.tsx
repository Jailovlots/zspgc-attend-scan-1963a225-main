import { useState, useMemo, useEffect } from "react";
import { LayoutGrid, Plus, Trash2, Edit2, ChevronRight, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
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
import { getCourseSections, saveCourseSections, getSession } from "@/lib/auth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const AdminSections = () => {
    const navigate = useNavigate();
    const session = getSession();
    const adminRole = session?.adminRole;
    const [courseSections, setCourseSections] = useState<Record<string, Record<string, string[]>>>({}); 

    // Add Course Modal State
    const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
    const [newCourseName, setNewCourseName] = useState("");

    // Add Year Level Modal State
    const [isAddYearOpen, setIsAddYearOpen] = useState(false);
    const [newYearData, setNewYearData] = useState<{ course: string, year: string }>({ course: "", year: "" });

    // Edit Section Modal State
    const [isEditSectionOpen, setIsEditSectionOpen] = useState(false);
    const [editSectionData, setEditSectionData] = useState<{
        course: string;
        oldYear: string;
        oldName: string;
        newYear: string;
        newName: string;
    } | null>(null);

    const [newSectionNames, setNewSectionNames] = useState<Record<string, string>>({});
    const [editingNode, setEditingNode] = useState<{ type: 'course', course: string, oldName: string, newName: string } | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Generic Delete State
    const [deleteConfig, setDeleteConfig] = useState<{
        type: 'section' | 'course' | 'yearLevel',
        course: string,
        year?: string,
        section?: string
    } | null>(null);

    useEffect(() => {
        if (!session || session.role !== "admin") {
            toast.error("Please log in as an admin to access this page");
            navigate("/login");
            return;
        }

        if (session.adminRole === "officer") {
            toast.error("You do not have permission to access the Sections page");
            navigate("/admin");
            return;
        }

        const init = async () => {
            setIsLoading(true);
            try {
                const data = await getCourseSections();
                setCourseSections(data);
            } catch (err) {
                toast.error("Failed to load sections");
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, []);

    const handleSave = async (updated: Record<string, Record<string, string[]>>) => {
        setIsSaving(true);
        try {
            const success = await saveCourseSections(updated);
            if (success) {
                setCourseSections(updated);
            } else {
                toast.error("Failed to save changes to server");
            }
        } catch (err) {
            toast.error("Network error saving changes");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteSection = (course: string, year: string, section: string) => {
        setDeleteConfig({ type: 'section', course, year, section });
    };

    const confirmDelete = async () => {
        if (!deleteConfig) return;
        const { type, course, year, section } = deleteConfig;
        const updated = { ...courseSections };

        if (type === 'section' && year && section) {
            updated[course][year] = updated[course][year].filter(s => s !== section);
            await handleSave(updated);
            toast.success(`Removed section ${section}`);
        } else if (type === 'course') {
            delete updated[course];
            await handleSave(updated);
            toast.success(`Course ${course} removed`);
        } else if (type === 'yearLevel' && year) {
            delete updated[course][year];
            await handleSave(updated);
            toast.success(`Removed ${year}`);
        }

        setDeleteConfig(null);
    };

    const handleAddCourse = () => {
        if (!newCourseName.trim()) {
            toast.error("Please enter a course name");
            return;
        }
        if (courseSections[newCourseName]) {
            toast.error("Course already exists");
            return;
        }

        const updated = { ...courseSections };
        // Initialize as completely empty object, year levels added dynamically
        updated[newCourseName] = {};

        handleSave(updated);
        setNewCourseName("");
        setIsAddCourseOpen(false);
        toast.success(`Course ${newCourseName} added successfully`);
    };

    const handleDeleteCourse = (course: string) => {
        setDeleteConfig({ type: 'course', course });
    };

    const handleAddYearLevel = () => {
        const { course, year } = newYearData;
        if (!year.trim()) {
            toast.error("Please enter a year level name");
            return;
        }

        const updated = { ...courseSections };
        if (!updated[course]) updated[course] = {};

        if (updated[course][year]) {
            toast.error("This year level already exists in this course");
            return;
        }

        updated[course][year] = [];
        handleSave(updated);
        setIsAddYearOpen(false);
        setNewYearData({ course: "", year: "" });
        toast.success(`Year Level ${year} added to ${course}`);
    };

    const handleDeleteYearLevel = (course: string, year: string, e: React.MouseEvent) => {
        e.stopPropagation(); // prevent opening accordion
        setDeleteConfig({ type: 'yearLevel', course, year });
    };

    const handleAddSection = (course: string, year: string) => {
        const sectionName = newSectionNames[`${course}-${year}`];
        if (!sectionName || !sectionName.trim()) return;

        const updated = { ...courseSections };
        if (!updated[course]) {
            updated[course] = {};
        }
        if (!updated[course][year]) {
            updated[course][year] = [];
        }

        if (!updated[course][year].includes(sectionName)) {
            updated[course][year] = [...updated[course][year], sectionName].sort();
            handleSave(updated);
            setNewSectionNames(prev => ({ ...prev, [`${course}-${year}`]: "" }));
            toast.success(`Added ${sectionName} to ${course} ${year}`);
        } else {
            toast.error("Section already exists");
        }
    };

    const handleRenameCourse = (oldName: string, newName: string) => {
        if (!newName.trim() || oldName === newName) {
            setEditingNode(null);
            return;
        }
        if (courseSections[newName]) {
            toast.error("Course name already exists");
            return;
        }

        const updated = { ...courseSections };
        const data = updated[oldName];
        delete updated[oldName];
        updated[newName] = data;
        handleSave(updated);
        setEditingNode(null);
        toast.success(`Renamed ${oldName} to ${newName}`);
    };

    const handleOpenEditSection = (course: string, year: string, section: string) => {
        setEditSectionData({
            course,
            oldYear: year,
            oldName: section,
            newYear: year,
            newName: section
        });
        setIsEditSectionOpen(true);
    };

    const handleSaveSectionEdit = () => {
        if (!editSectionData) return;
        const { course, oldYear, oldName, newYear, newName } = editSectionData;

        if (!newName.trim()) {
            toast.error("Section name cannot be empty");
            return;
        }

        const updated = { ...courseSections };

        // If they just clicked save without changing anything, close it
        if (oldName === newName && oldYear === newYear) {
            setIsEditSectionOpen(false);
            return;
        }

        // Check if new name already exists in target year
        if (updated[course] && updated[course][newYear] && updated[course][newYear].includes(newName) && (oldName !== newName || oldYear !== newYear)) {
            toast.error(`Section ${newName} already exists in ${newYear}`);
            return;
        }

        // Remove from old year
        if (updated[course][oldYear]) {
            updated[course][oldYear] = updated[course][oldYear].filter(s => s !== oldName);
        }

        // Add to new year
        if (!updated[course][newYear]) updated[course][newYear] = [];
        updated[course][newYear] = [...updated[course][newYear], newName].sort();

        handleSave(updated);
        setIsEditSectionOpen(false);
        toast.success(`Updated section to ${newName} in ${newYear}`);
    };

    return (
        <DashboardLayout role="admin" adminRole={adminRole}>
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-3">
                            <LayoutGrid className="h-7 w-7 text-gold" />
                            Sectioning Management
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">Manage courses, custom year levels, and sections</p>
                    </div>
                    <Button onClick={() => setIsAddCourseOpen(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
                        <Plus className="h-4 w-4 mr-2" /> Add Course
                    </Button>
                </div>

                <div className="grid gap-6">
                    {Object.keys(courseSections).sort().map((course) => (
                        <Card key={course} className="shadow-card overflow-hidden border-l-4 border-l-gold">
                            <CardHeader className="bg-muted/30 py-4 flex flex-row items-center justify-between">
                                {editingNode?.type === 'course' && editingNode.oldName === course ? (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            value={editingNode.newName}
                                            onChange={(e) => setEditingNode({ ...editingNode, newName: e.target.value })}
                                            className="h-8 w-40"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleRenameCourse(course, editingNode.newName);
                                                if (e.key === 'Escape') setEditingNode(null);
                                            }}
                                        />
                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-success" onClick={() => handleRenameCourse(course, editingNode.newName)}>
                                            <Save className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" onClick={() => setEditingNode(null)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-lg font-display">{course}</CardTitle>
                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setEditingNode({ type: 'course', oldName: course, newName: course, course })}>
                                            <Edit2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setNewYearData({ course, year: "" });
                                            setIsAddYearOpen(true);
                                        }}
                                    >
                                        <Plus className="h-4 w-4 mr-1" /> Add Year Level
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDeleteCourse(course)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Accordion type="multiple" className="w-full">
                                    {Object.keys(courseSections[course] || {}).sort().map((year) => (
                                        <AccordionItem key={year} value={`${course}-${year}`} className="border-b px-6">
                                            <AccordionTrigger className="hover:no-underline py-4">
                                                <div className="flex flex-1 items-center justify-between pr-4">
                                                    <div className="flex items-center gap-4">
                                                        <span className="font-semibold text-sm">{year}</span>
                                                        <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground font-bold">
                                                            {(courseSections[course]?.[year] || []).length} SECTIONS
                                                        </span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                                                        onClick={(e) => handleDeleteYearLevel(course, year, e)}
                                                        title="Delete Year Level"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pb-6">
                                                <div className="space-y-4">
                                                    {/* Sections List */}
                                                    <div className="flex flex-wrap gap-2">
                                                        {(courseSections[course]?.[year] || []).map((section) => (
                                                            <div
                                                                key={section}
                                                                className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-lg border border-border group"
                                                            >
                                                                <span className="text-sm font-medium">{section}</span>
                                                                <div className="flex items-center gap-1 transition-opacity">
                                                                    <button
                                                                        onClick={() => handleOpenEditSection(course, year, section)}
                                                                        className="text-muted-foreground hover:text-gold transition-colors p-1"
                                                                        title="Edit Section"
                                                                    >
                                                                        <Edit2 className="h-3.5 w-3.5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteSection(course, year, section)}
                                                                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                                                                        title="Delete Section"
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {(courseSections[course]?.[year] || []).length === 0 && (
                                                            <p className="text-xs text-muted-foreground italic py-2">No sections defined for this year level.</p>
                                                        )}
                                                    </div>

                                                    {/* Add Section Input */}
                                                    <div className="flex items-center gap-2 max-w-sm pt-2">
                                                        <Input
                                                            placeholder={`Add section in ${year}`}
                                                            value={newSectionNames[`${course}-${year}`] || ""}
                                                            onChange={(e) => setNewSectionNames(prev => ({ ...prev, [`${course}-${year}`]: e.target.value }))}
                                                            className="h-9"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleAddSection(course, year);
                                                            }}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleAddSection(course, year)}
                                                        >
                                                            Add
                                                        </Button>
                                                    </div>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                    {Object.keys(courseSections[course] || {}).length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center py-6 border-b border-dashed">No Year Levels created yet. Click "Add Year Level" above.</p>
                                    )}
                                </Accordion>
                            </CardContent>
                        </Card>
                    ))}

                    {Object.keys(courseSections).length === 0 && (
                        <div className="text-center py-12 bg-muted/20 rounded-xl border-2 border-dashed">
                            <LayoutGrid className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                            <h3 className="text-lg font-medium text-muted-foreground">No Courses Found</h3>
                            <p className="text-sm text-muted-foreground mt-1">Add your first course to begin sectioning</p>
                            <Button onClick={() => setIsAddCourseOpen(true)} className="mt-4 bg-gold text-gold-foreground">
                                Add Course
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Course Dialog */}
            <Dialog open={isAddCourseOpen} onOpenChange={setIsAddCourseOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add New Course</DialogTitle>
                        <DialogDescription>
                            Enter the code for the new course (e.g. BSIS, ACT, BSCS).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="courseName">Course Code</Label>
                        <Input
                            id="courseName"
                            placeholder="e.g. BSIS"
                            className="mt-1"
                            value={newCourseName}
                            onChange={(e) => setNewCourseName(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddCourseOpen(false)}>Cancel</Button>
                        <Button disabled={isSaving} className="bg-gold text-gold-foreground" onClick={handleAddCourse}>
                            {isSaving ? "Adding..." : "Add Course"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Year Level Dialog */}
            <Dialog open={isAddYearOpen} onOpenChange={setIsAddYearOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add Year Level</DialogTitle>
                        <DialogDescription>
                            Create a new year level categorical group for {newYearData.course}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="yearName">Year Level Name</Label>
                        <Input
                            id="yearName"
                            placeholder="e.g. 5th Year, Irregular"
                            className="mt-1"
                            value={newYearData.year}
                            onChange={(e) => setNewYearData(prev => ({ ...prev, year: e.target.value }))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddYearLevel();
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddYearOpen(false)}>Cancel</Button>
                        <Button disabled={isSaving} className="bg-gold text-gold-foreground" onClick={handleAddYearLevel}>
                            {isSaving ? "Adding..." : "Add Year Level"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Section Dialog */}
            <Dialog open={isEditSectionOpen} onOpenChange={setIsEditSectionOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Section</DialogTitle>
                        <DialogDescription>
                            Update the section name or move it to a different year level.
                        </DialogDescription>
                    </DialogHeader>
                    {editSectionData && (
                        <div className="py-4 space-y-4">
                            <div>
                                <Label htmlFor="editSectionName">Section Name</Label>
                                <Input
                                    id="editSectionName"
                                    className="mt-1"
                                    value={editSectionData.newName}
                                    onChange={(e) => setEditSectionData({ ...editSectionData, newName: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="editYearLevel">Year Level</Label>
                                <Select
                                    value={editSectionData.newYear}
                                    onValueChange={(val) => setEditSectionData({ ...editSectionData, newYear: val })}
                                >
                                    <SelectTrigger className="mt-1 w-full relative z-50 bg-background text-foreground border-input shadow-sm">
                                        <SelectValue placeholder="Select year level" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" className="z-50 bg-background text-foreground shadow-md min-w-[8rem] border-input">
                                        {Object.keys(courseSections[editSectionData.course] || {}).sort().map(y => (
                                            <SelectItem key={y} value={y} className="hover:bg-accent focus:bg-accent cursor-pointer z-50">{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditSectionOpen(false)}>Cancel</Button>
                        <Button disabled={isSaving} className="bg-gold text-gold-foreground" onClick={handleSaveSectionEdit}>
                            {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Global Delete Confirmation */}
            <AlertDialog open={!!deleteConfig} onOpenChange={(o) => !o && setDeleteConfig(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {deleteConfig?.type === 'course' ? 'Delete Course?' : 
                             deleteConfig?.type === 'yearLevel' ? 'Delete Year Level?' : 
                             'Remove Section?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteConfig?.type === 'course' 
                                ? `Are you sure you want to delete ${deleteConfig.course}? All associated year levels and sections will be completely removed.` 
                                : deleteConfig?.type === 'yearLevel'
                                ? `Are you sure you want to delete ${deleteConfig.year} from ${deleteConfig.course}? All sections inside it will be lost.`
                                : `Remove section ${deleteConfig?.section} from ${deleteConfig?.year}?`}
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

export default AdminSections;
