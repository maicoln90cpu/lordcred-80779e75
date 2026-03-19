import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Mail, Loader2 } from 'lucide-react';
import logoExtended from '@/assets/logo-extended.png';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres')
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);

    const { error } = await signIn(data.email, data.password);

    if (error) {
      const isEmailNotConfirmed = error.message?.toLowerCase().includes('email not confirmed');
      toast({
        title: isEmailNotConfirmed ? 'Email não confirmado' : 'Erro ao entrar',
        description: isEmailNotConfirmed
          ? 'Verifique sua caixa de entrada (e spam) para confirmar seu email antes de entrar.'
          : 'Email ou senha incorretos',
        variant: isEmailNotConfirmed ? 'default' : 'destructive'
      });
    } else {
      // Check user role to determine redirect
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', authUser.id)
          .single();
        
        const role = roleData?.role;
        if (role === 'seller') {
          navigate('/whatsapp');
        } else if (role === 'support') {
          navigate('/dashboard');
        } else {
          navigate('/whatsapp');
        }
      } else {
        navigate('/whatsapp');
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <img src={logoExtended} alt="Cred" className="mx-auto h-40 object-contain" />
          <div>
            <CardTitle className="text-2xl font-bold">Entrar</CardTitle>
            <CardDescription className="text-muted-foreground">
              Sistema de Aquecimento WhatsApp
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) =>
                <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                        placeholder="seu@email.com"
                        className="pl-10 bg-secondary/50"
                        {...field} />

                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                } />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) =>
                <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                        type="password"
                        placeholder="••••••••"
                        className="pl-10 bg-secondary/50"
                        {...field} />

                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                } />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ?
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </> :

                'Entrar'
                }
              </Button>
            </form>
          </Form>
          <div className="mt-6 text-center">
            <button
              type="button"
              className="text-sm text-primary hover:underline font-medium"
              onClick={async () => {
                const email = form.getValues('email');
                if (!email || !email.includes('@')) {
                  toast({ title: 'Informe seu email', description: 'Digite seu email no campo acima antes de solicitar a recuperação', variant: 'destructive' });
                  return;
                }
                try {
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  if (error) throw error;
                  toast({ title: 'Email enviado', description: 'Verifique sua caixa de entrada (e spam) para redefinir sua senha' });
                } catch (error: any) {
                  toast({ title: 'Erro', description: error.message || 'Não foi possível enviar o email', variant: 'destructive' });
                }
              }}
            >
              Esqueci minha senha
            </button>
          </div>
        </CardContent>
      </Card>
    </div>);

}