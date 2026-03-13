import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  Smartphone,
  MessageSquare,
  FileSpreadsheet,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Crown,
  ArrowLeft,
  BarChart3,
  Columns3,
  Link2
} from 'lucide-react';
import logoExtended from '@/assets/logo-new.png';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Meus Chips', icon: Smartphone, href: '/chips' },
  { label: 'Mensagens', icon: MessageSquare, href: '/messages' },
  { label: 'Vendedores', icon: Users, href: '/admin/users' },
  { label: 'Leads', icon: FileSpreadsheet, href: '/admin/leads' },
  { label: 'Performance', icon: BarChart3, href: '/admin/performance' },
  { label: 'Kanban', icon: Columns3, href: '/admin/kanban' },
  { label: 'Links Úteis', icon: Link2, href: '/admin/links' },
  { label: 'Configurações', icon: Settings, href: '/settings' },
  { label: 'Master Admin', icon: Crown, href: '/admin/master', adminOnly: true },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "hidden md:flex flex-col fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 z-50",
          sidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <div className={cn("flex items-center gap-3", !sidebarOpen && "justify-center w-full")}>
            <img src={logoExtended} alt="LordCred" className="h-8 w-auto" />
            {sidebarOpen && (
              <span className="font-bold text-lg">LordCred</span>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn("hover:bg-sidebar-accent", !sidebarOpen && "hidden")}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                  !sidebarOpen && "justify-center"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border space-y-2">
          <Button 
            variant="outline" 
            onClick={() => navigate('/whatsapp')}
            className={cn(
              "w-full justify-start text-muted-foreground hover:text-foreground",
              !sidebarOpen && "justify-center"
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            {sidebarOpen && <span className="ml-3">Voltar ao Chat</span>}
          </Button>

          <div className={cn("flex items-center gap-3", !sidebarOpen && "justify-center")}>
            <div className="w-9 h-9 bg-primary/20 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.email}</p>
                <p className="text-xs text-muted-foreground">
                  {isAdmin ? 'Master' : 'Administrador'}
                </p>
              </div>
            )}
          </div>
          <Button 
            variant="ghost" 
            onClick={handleSignOut}
            className={cn(
              "w-full justify-start text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
              !sidebarOpen && "justify-center"
            )}
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span className="ml-3">Sair</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <img src={logoExtended} alt="LordCred" className="h-7 w-auto" />
          <span className="font-bold">LordCred</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div className="fixed top-16 left-0 right-0 bg-sidebar border-b border-sidebar-border p-4" onClick={(e) => e.stopPropagation()}>
            <nav className="space-y-2">
              {filteredNavItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 pt-4 border-t border-sidebar-border space-y-2">
              <Button 
                variant="outline" 
                onClick={() => { navigate('/whatsapp'); setMobileMenuOpen(false); }}
                className="w-full justify-start text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-3" />
                Voltar ao Chat
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleSignOut}
                className="w-full justify-start text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 min-h-screen overflow-x-hidden transition-all duration-300",
          sidebarOpen ? "md:ml-64" : "md:ml-20",
          "pt-16 md:pt-0"
        )}
      >
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
