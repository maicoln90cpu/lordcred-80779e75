import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Chips from "./pages/Chips";
import Messages from "./pages/Messages";
import Users from "./pages/admin/Users";
import Settings from "./pages/admin/Settings";
import MasterAdmin from "./pages/admin/MasterAdmin";
import Leads from "./pages/admin/Leads";
import Performance from "./pages/admin/Performance";
import KanbanAdmin from "./pages/admin/KanbanAdmin";
import LinksAdmin from "./pages/admin/LinksAdmin";
import InternalChat from "./pages/admin/InternalChat";
import WhatsApp from "./pages/WhatsApp";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<Navigate to="/whatsapp" replace />} />
              <Route path="/whatsapp" element={<ProtectedRoute><WhatsApp /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute blockSellers><Dashboard /></ProtectedRoute>} />
              <Route path="/chips" element={<ProtectedRoute blockSellers><Chips /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute blockSellers><Messages /></ProtectedRoute>} />
              <Route path="/history" element={<Navigate to="/messages" replace />} />
              <Route path="/admin/users" element={<ProtectedRoute blockSellers><Users /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute blockSellers><Settings /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<Navigate to="/settings" replace />} />
              <Route path="/admin/leads" element={<ProtectedRoute blockSellers><Leads /></ProtectedRoute>} />
              <Route path="/admin/performance" element={<ProtectedRoute blockSellers blockSupport><Performance /></ProtectedRoute>} />
              <Route path="/admin/kanban" element={<ProtectedRoute blockSellers><KanbanAdmin /></ProtectedRoute>} />
              <Route path="/admin/links" element={<ProtectedRoute blockSellers><LinksAdmin /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><InternalChat /></ProtectedRoute>} />
              <Route path="/admin/chat" element={<Navigate to="/chat" replace />} />
              <Route path="/admin/master" element={<ProtectedRoute requireAdmin><MasterAdmin /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
