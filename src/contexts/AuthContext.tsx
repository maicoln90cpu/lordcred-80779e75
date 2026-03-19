import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'master' | 'admin' | 'seller' | 'support';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isMaster: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  isSupport: boolean;
  userRole: UserRole;
  isLoading: boolean;
  isBlocked: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('seller');
  const [isLoading, setIsLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  const isMaster = userRole === 'master';
  const isAdmin = userRole === 'master' || userRole === 'admin';
  const isSeller = userRole === 'seller';
  const isSupport = userRole === 'support';

  const checkUserRole = async (userId: string) => {
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      setUserRole((roleData?.role as UserRole) ?? 'seller');

      const { data: profileData } = await supabase
        .from('profiles')
        .select('is_blocked')
        .eq('user_id', userId)
        .single();

      setIsBlocked(profileData?.is_blocked ?? false);
    } catch (error) {
      console.error('Error checking user role:', error);
      setUserRole('seller');
      setIsBlocked(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => checkUserRole(session.user.id), 0);
        } else {
          setUserRole('seller');
          setIsBlocked(false);
        }
        
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        checkUserRole(session.user.id);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole('seller');
    setIsBlocked(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, isMaster, isAdmin, isSeller, isSupport, userRole, isLoading, isBlocked, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
