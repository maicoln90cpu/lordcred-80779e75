import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { InternalChatUnreadProvider } from "@/contexts/InternalChatUnreadContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import LoadingFallback from "@/components/LoadingFallback";
import ErrorBoundary from "@/components/ErrorBoundary";

// Lazy-loaded pages — each loads only when accessed
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Chips = lazy(() => import("./pages/Chips"));
const Messages = lazy(() => import("./pages/Messages"));
const WhatsApp = lazy(() => import("./pages/WhatsApp"));
const Landing = lazy(() => import("./pages/Landing"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin pages
const Users = lazy(() => import("./pages/admin/Users"));
const Settings = lazy(() => import("./pages/admin/Settings"));
const MasterAdmin = lazy(() => import("./pages/admin/MasterAdmin"));
const Leads = lazy(() => import("./pages/admin/Leads"));
const Performance = lazy(() => import("./pages/admin/Performance"));
const KanbanAdmin = lazy(() => import("./pages/admin/KanbanAdmin"));
const LinksAdmin = lazy(() => import("./pages/admin/LinksAdmin"));
const ChipMonitor = lazy(() => import("./pages/admin/ChipMonitor"));
const InternalChat = lazy(() => import("./pages/admin/InternalChat"));
const Tickets = lazy(() => import("./pages/admin/Tickets"));
const AuditLogs = lazy(() => import("./pages/admin/AuditLogs"));
const QueueManagement = lazy(() => import("./pages/admin/QueueManagement"));
const WebhookDiagnostics = lazy(() => import("./pages/admin/WebhookDiagnostics"));
const Templates = lazy(() => import("./pages/admin/Templates"));
const QuickReplies = lazy(() => import("./pages/admin/QuickReplies"));
const RemoteAssistance = lazy(() => import("./pages/admin/RemoteAssistance"));
const WarmingReports = lazy(() => import("./pages/admin/WarmingReports"));
const ProductInfo = lazy(() => import("./pages/admin/ProductInfo"));
const Commissions = lazy(() => import("./pages/admin/Commissions"));
const CommissionReports = lazy(() => import("./pages/admin/CommissionReports"));
const Permissions = lazy(() => import("./pages/admin/Permissions"));
const BankCredentials = lazy(() => import("./pages/admin/BankCredentials"));
const PartnersAdmin = lazy(() => import("./pages/admin/PartnersAdmin"));
const PartnerDetail = lazy(() => import("./pages/admin/PartnerDetail"));
const ContractTemplate = lazy(() => import("./pages/admin/ContractTemplate"));
const Broadcasts = lazy(() => import("./pages/admin/Broadcasts"));
const Integrations = lazy(() => import("./pages/admin/Integrations"));

// Corban pages
const CorbanDashboard = lazy(() => import("./pages/admin/CorbanDashboard"));
const CorbanPropostas = lazy(() => import("./pages/admin/CorbanPropostas"));
const CorbanFGTS = lazy(() => import("./pages/admin/CorbanFGTS"));
const CorbanAssets = lazy(() => import("./pages/admin/CorbanAssets"));
const CorbanConfig = lazy(() => import("./pages/admin/CorbanConfig"));
const SellerPropostas = lazy(() => import("./pages/corban/SellerPropostas"));
const SellerFGTS = lazy(() => import("./pages/corban/SellerFGTS"));
const SellerDashboard = lazy(() => import("./pages/corban/SellerDashboard"));

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
          <InternalChatUnreadProvider>
            <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <Routes>
                <Route path="/landing" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/" element={<Navigate to="/whatsapp" replace />} />
                <Route path="/whatsapp" element={<ProtectedRoute><WhatsApp /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute blockSellers><Dashboard /></ProtectedRoute>} />
                <Route path="/chips" element={<ProtectedRoute blockSellers><Chips /></ProtectedRoute>} />
                <Route path="/messages" element={<ProtectedRoute blockSellers><Messages /></ProtectedRoute>} />
                <Route path="/history" element={<Navigate to="/messages" replace />} />
                <Route path="/admin/users" element={<ProtectedRoute blockSellers><Users /></ProtectedRoute>} />
                <Route path="/settingsaquecimento" element={<ProtectedRoute blockSellers><Settings /></ProtectedRoute>} />
                <Route path="/settings" element={<Navigate to="/settingsaquecimento" replace />} />
                <Route path="/admin/settings" element={<Navigate to="/settingsaquecimento" replace />} />
                <Route path="/admin/leads" element={<ProtectedRoute blockSellers><Leads /></ProtectedRoute>} />
                <Route path="/admin/performance" element={<ProtectedRoute blockSellers blockSupport><Performance /></ProtectedRoute>} />
                <Route path="/admin/kanban" element={<ProtectedRoute blockSellers><KanbanAdmin /></ProtectedRoute>} />
                <Route path="/admin/links" element={<ProtectedRoute blockSellers><LinksAdmin /></ProtectedRoute>} />
                <Route path="/admin/chip-monitor" element={<ProtectedRoute blockSellers blockSupport={false}><ChipMonitor /></ProtectedRoute>} />
                <Route path="/chat" element={<ProtectedRoute><InternalChat /></ProtectedRoute>} />
                <Route path="/admin/chat" element={<Navigate to="/chat" replace />} />
                <Route path="/admin/tickets" element={<ProtectedRoute><Tickets /></ProtectedRoute>} />
                <Route path="/admin/audit-logs" element={<ProtectedRoute blockSellers><AuditLogs /></ProtectedRoute>} />
                <Route path="/admin/queue" element={<ProtectedRoute blockSellers><QueueManagement /></ProtectedRoute>} />
                <Route path="/admin/webhooks" element={<ProtectedRoute blockSellers><WebhookDiagnostics /></ProtectedRoute>} />
                <Route path="/admin/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
                <Route path="/admin/quick-replies" element={<ProtectedRoute><QuickReplies /></ProtectedRoute>} />
                <Route path="/admin/remote" element={<ProtectedRoute blockSellers><RemoteAssistance /></ProtectedRoute>} />
                <Route path="/admin/warming-reports" element={<ProtectedRoute blockSellers><WarmingReports /></ProtectedRoute>} />
                <Route path="/admin/product-info" element={<ProtectedRoute blockSellers><ProductInfo /></ProtectedRoute>} />
                <Route path="/admin/commissions" element={<ProtectedRoute><Commissions /></ProtectedRoute>} />
                <Route path="/admin/commission-reports" element={<ProtectedRoute><CommissionReports /></ProtectedRoute>} />
                <Route path="/admin/corban" element={<ProtectedRoute blockSellers><CorbanDashboard /></ProtectedRoute>} />
                <Route path="/admin/corban/propostas" element={<ProtectedRoute blockSellers><CorbanPropostas /></ProtectedRoute>} />
                <Route path="/admin/corban/fgts" element={<ProtectedRoute blockSellers><CorbanFGTS /></ProtectedRoute>} />
                <Route path="/admin/corban/assets" element={<ProtectedRoute blockSellers><CorbanAssets /></ProtectedRoute>} />
                <Route path="/admin/corban/config" element={<ProtectedRoute blockSellers><CorbanConfig /></ProtectedRoute>} />
                <Route path="/corban/propostas" element={<ProtectedRoute><SellerPropostas /></ProtectedRoute>} />
                <Route path="/corban/fgts" element={<ProtectedRoute><SellerFGTS /></ProtectedRoute>} />
                <Route path="/corban/dashboard" element={<ProtectedRoute><SellerDashboard /></ProtectedRoute>} />
                <Route path="/admin/permissions" element={<ProtectedRoute blockSellers><Permissions /></ProtectedRoute>} />
                <Route path="/admin/bancos" element={<ProtectedRoute blockSellers><BankCredentials /></ProtectedRoute>} />
                <Route path="/admin/parceiros" element={<ProtectedRoute blockSellers><PartnersAdmin /></ProtectedRoute>} />
                <Route path="/admin/parceiros/template" element={<ProtectedRoute blockSellers><ContractTemplate /></ProtectedRoute>} />
                <Route path="/admin/parceiros/:id" element={<ProtectedRoute blockSellers><PartnerDetail /></ProtectedRoute>} />
                <Route path="/admin/broadcasts" element={<ProtectedRoute blockSellers><Broadcasts /></ProtectedRoute>} />
                <Route path="/admin/integrations" element={<ProtectedRoute blockSellers><Integrations /></ProtectedRoute>} />
                <Route path="/admin/master" element={<ProtectedRoute requireAdmin><MasterAdmin /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </ErrorBoundary>
          </InternalChatUnreadProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
