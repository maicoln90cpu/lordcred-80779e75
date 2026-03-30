import { ReactNode, useState } from 'react';
import MyProfilePanel from '@/components/profile/MyProfilePanel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Link2,
  Activity,
  Ticket,
  Shield,
  ListOrdered,
  Webhook,
  FileText,
  Eye,
  User,
  PackageSearch,
  Building2,
  ClipboardList,
  Landmark,
  Database,
  Cog,
  Zap
} from 'lucide-react';
import logoExtended from '@/assets/logo-new.png';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useInternalChatUnread } from '@/hooks/useInternalChatUnread';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
  adminOnly?: boolean;
  sellerHidden?: boolean;
  supportHidden?: boolean;
}

interface NavGroup {
  groupLabel: string;
  items: NavItem[];
}

interface NavSubItem {
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
}

interface NavItemWithChildren extends NavItem {
  children?: NavSubItem[];
}

interface NavGroupWithChildren {
  groupLabel: string;
  items: NavItemWithChildren[];
}

const navGroups: NavGroupWithChildren[] = [
  {
    groupLabel: 'Aquecimento',
    items: [
      { label: 'Dash. Aquecimento', icon: LayoutDashboard, href: '/dashboard', sellerHidden: true },
      { label: 'Meus Chips', icon: Smartphone, href: '/chips', sellerHidden: true },
      { label: 'Config. Aquecimento', icon: Settings, href: '/settingsaquecimento', sellerHidden: true },
      { label: 'Relat. Aquecimento', icon: BarChart3, href: '/admin/warming-reports', sellerHidden: true },
    ],
  },
  {
    groupLabel: 'Equipe',
    items: [
      { label: 'Usuários', icon: Users, href: '/admin/users', sellerHidden: true },
      { label: 'Leads', icon: FileSpreadsheet, href: '/admin/leads', sellerHidden: true },
      { label: 'Performance', icon: BarChart3, href: '/admin/performance', sellerHidden: true, supportHidden: true },
      { label: 'Kanban', icon: Columns3, href: '/admin/kanban', sellerHidden: true },
      { label: 'Info Produtos', icon: PackageSearch, href: '/admin/product-info', sellerHidden: true },
      { label: 'Comissões Parceiros', icon: DollarSign, href: '/admin/commissions' },
    ],
  },
  {
    groupLabel: 'Operações',
    items: [
      { label: 'Monitor de Chips', icon: Activity, href: '/admin/chip-monitor', sellerHidden: true },
      { label: 'Fila de Mensagens', icon: ListOrdered, href: '/admin/queue', sellerHidden: true },
      { label: 'Webhooks', icon: Webhook, href: '/admin/webhooks', sellerHidden: true },
      { label: 'Templates', icon: FileText, href: '/admin/templates' },
      { label: 'Notas Rápidas', icon: Zap, href: '/admin/quick-replies' },
    ],
  },
  {
    groupLabel: 'Comunicação',
    items: [
      { label: 'Tickets', icon: Ticket, href: '/admin/tickets' },
      { label: 'Chat Interno', icon: MessageSquare, href: '/chat' },
    ],
  },
  {
    groupLabel: 'Ferramentas',
    items: [
      { label: 'Links Úteis', icon: Link2, href: '/admin/links', sellerHidden: true },
      { label: 'Assistência Remota', icon: Eye, href: '/admin/remote', sellerHidden: true },
      { label: 'Logs de Auditoria', icon: Shield, href: '/admin/audit-logs', sellerHidden: true },
    ],
  },
  {
    groupLabel: 'Corban',
    items: [
      { label: 'Dashboard Corban', icon: Building2, href: '/admin/corban', sellerHidden: true },
      { label: 'Propostas', icon: ClipboardList, href: '/admin/corban/propostas', sellerHidden: true },
      { label: 'FGTS', icon: Landmark, href: '/admin/corban/fgts', sellerHidden: true },
      { label: 'Assets/Tabelas', icon: Database, href: '/admin/corban/assets', sellerHidden: true },
      { label: 'Config Corban', icon: Cog, href: '/admin/corban/config', sellerHidden: true },
      { label: 'Minhas Propostas', icon: ClipboardList, href: '/corban/propostas', supportHidden: true },
      { label: 'Consulta FGTS', icon: Landmark, href: '/corban/fgts', supportHidden: true },
    ],
  },
  {
    groupLabel: 'Sistema',
    items: [
      { label: 'Master Admin', icon: Crown, href: '/admin/master', adminOnly: true },
    ],
  },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const { user, isMaster, isAdmin, isSeller, isSupport, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { totalUnread } = useInternalChatUnread();

  const filterItems = (items: NavItem[]) =>
    items.filter(item => {
      if (item.adminOnly && !isMaster) return false;
      if (item.sellerHidden && isSeller) return false;
      if (item.supportHidden && isSupport) return false;
      return true;
    });

  const filteredGroups = navGroups
    .map(group => ({ ...group, items: filterItems(group.items) }))
    .filter(group => group.items.length > 0);

  const getRoleLabel = () => {
    if (isSeller) return 'Vendedor';
    if (isSupport) return 'Suporte';
    if (isMaster) return 'Master';
    return 'Administrador';
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const renderNavItem = (item: NavItem, isActive: boolean, collapsed = false) => (
    <Link
      key={item.href}
      to={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors relative text-sm",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent",
        collapsed && "justify-center"
      )}
    >
      <item.icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
      {item.href === '/chat' && totalUnread > 0 && (
        <Badge className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-[10px] bg-destructive text-destructive-foreground border-0">
          {totalUnread > 99 ? '99+' : totalUnread}
        </Badge>
      )}
    </Link>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 z-50",
          sidebarOpen ? "w-60" : "w-16"
        )}
      >
        <div className="flex items-center justify-between p-3 border-b border-sidebar-border">
          <div className={cn("flex items-center gap-2", !sidebarOpen && "justify-center w-full")}>
            <img src={logoExtended} alt="LordCred" className="h-7 w-auto" />
            {sidebarOpen && <span className="font-bold text-base">LordCred</span>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn("hover:bg-sidebar-accent h-7 w-7", !sidebarOpen && "hidden")}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredGroups.map((group) => (
            <div key={group.groupLabel}>
              {sidebarOpen && (
                <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.groupLabel}
                </p>
              )}
              {!sidebarOpen && (
                <div className="my-2 mx-2 border-t border-sidebar-border" />
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <div key={item.href}>
                    {renderNavItem(item, location.pathname === item.href, !sidebarOpen)}
                    {(item as NavItemWithChildren).children?.map((child) => (
                      <Link
                        key={child.href}
                        to={child.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg transition-colors relative text-xs",
                          sidebarOpen ? "pl-10 pr-3 py-1.5" : "px-3 py-2 justify-center",
                          location.pathname === child.href
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        )}
                      >
                        <child.icon className="w-3.5 h-3.5 shrink-0" />
                        {sidebarOpen && <span>{child.label}</span>}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/whatsapp')}
            className={cn(
              "w-full justify-start text-muted-foreground hover:text-foreground",
              !sidebarOpen && "justify-center"
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            {sidebarOpen && <span className="ml-2">Voltar ao Chat</span>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setProfileDialogOpen(true)}
            className={cn(
              "w-full justify-start text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
              !sidebarOpen && "justify-center"
            )}
          >
            <User className="w-4 h-4" />
            {sidebarOpen && <span className="ml-2">Meu Perfil</span>}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className={cn(
              "w-full justify-start text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
              !sidebarOpen && "justify-center"
            )}
          >
            <LogOut className="w-4 h-4" />
            {sidebarOpen && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img src={logoExtended} alt="LordCred" className="h-6 w-auto" />
          <span className="font-bold text-sm">LordCred</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div className="fixed top-14 left-0 right-0 max-h-[calc(100vh-3.5rem)] overflow-y-auto bg-sidebar border-b border-sidebar-border p-3" onClick={(e) => e.stopPropagation()}>
            <nav className="space-y-1">
              {filteredGroups.map((group) => (
                <div key={group.groupLabel}>
                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.groupLabel}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <div key={item.href}>
                          <Link
                            to={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors relative text-sm",
                              isActive
                                ? "bg-primary text-primary-foreground"
                                : "text-sidebar-foreground hover:bg-sidebar-accent"
                            )}
                          >
                            <item.icon className="w-4 h-4" />
                            <span>{item.label}</span>
                            {item.href === '/chat' && totalUnread > 0 && (
                              <Badge className="ml-auto h-5 min-w-5 flex items-center justify-center p-0 text-[10px] bg-destructive text-destructive-foreground border-0">
                                {totalUnread > 99 ? '99+' : totalUnread}
                              </Badge>
                            )}
                          </Link>
                          {(item as NavItemWithChildren).children?.map((child) => (
                            <Link
                              key={child.href}
                              to={child.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className={cn(
                                "flex items-center gap-3 pl-10 pr-3 py-1.5 rounded-lg transition-colors text-xs",
                                location.pathname === child.href
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                              )}
                            >
                              <child.icon className="w-3.5 h-3.5" />
                              <span>{child.label}</span>
                            </Link>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <div className="mt-3 pt-3 border-t border-sidebar-border space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { navigate('/whatsapp'); setMobileMenuOpen(false); }}
                className="w-full justify-start text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Chat
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setProfileDialogOpen(true); setMobileMenuOpen(false); }}
                className="w-full justify-start text-muted-foreground hover:text-foreground"
              >
                <User className="w-4 h-4 mr-2" />
                Meu Perfil
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="w-full justify-start text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4 mr-2" />
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
          sidebarOpen ? "md:ml-60" : "md:ml-16",
          "pt-14 md:pt-0"
        )}
      >
        <div className="p-6">
          {children}
        </div>
      </main>

      {/* Profile Dialog */}
      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Meu Perfil</DialogTitle>
          </DialogHeader>
          <MyProfilePanel />
        </DialogContent>
      </Dialog>
    </div>
  );
}
