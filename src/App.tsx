import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import StudentDashboard from "./pages/StudentDashboard";
import StudentProfile from "./pages/StudentProfile";
import StudentQrCode from "./pages/StudentQrCode";
import StudentAttendance from "./pages/StudentAttendance";
import AdminDashboard from "./pages/AdminDashboard";
import AdminScanner from "./pages/AdminScanner";
import AdminStudents from "./pages/AdminStudents";
import AdminEvents from "./pages/AdminEvents";
import AdminSections from "./pages/AdminSections";
import AdminSettings from "./pages/AdminSettings";
import AdminReports from "./pages/AdminReports";
import NotFound from "./pages/NotFound";

import { useEffect } from "react";
import { migrateLocalStorageToServer } from "./lib/auth";
import { syncTimeWithServer } from "./lib/timeSync";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    migrateLocalStorageToServer();
    syncTimeWithServer();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/qr" element={<StudentQrCode />} />
            <Route path="/student/attendance" element={<StudentAttendance />} />
            <Route path="/student/profile" element={<StudentProfile />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/scanner" element={<AdminScanner />} />
            <Route path="/admin/students" element={<AdminStudents />} />
            <Route path="/admin/events" element={<AdminEvents />} />
            <Route path="/admin/sections" element={<AdminSections />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/*" element={<AdminDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
