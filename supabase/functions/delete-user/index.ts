import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { writeAuditLog } from '../_shared/auditLog.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user: caller }, error: authError } = await userClient.auth.getUser();
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: callerRole } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .single();

    // Allow master and admin (Administrador) roles
    if (callerRole?.role !== 'master' && callerRole?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Permissão negada' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (userId === caller.id) {
      return new Response(
        JSON.stringify({ error: 'You cannot delete yourself' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: targetRole } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (targetRole?.role === 'master') {
      return new Response(
        JSON.stringify({ error: 'Cannot delete master users' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If caller is 'admin' (Administrador), verify they created the target
    if (callerRole?.role === 'admin') {
      const { data: targetProfile } = await adminClient
        .from('profiles')
        .select('created_by')
        .eq('user_id', userId)
        .single();

      if (targetProfile?.created_by !== caller.id) {
        return new Response(
          JSON.stringify({ error: 'Você só pode excluir usuários que você criou' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Try to delete from auth - may not exist for migrated users
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      if (deleteError.status === 404 || deleteError.message?.includes('not found')) {
        console.log('Auth user not found, cleaning up profile data only');
      } else {
        console.error('Error deleting user:', deleteError);
        return new Response(
          JSON.stringify({ error: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Always clean up profile and role data
    await adminClient.from('user_roles').delete().eq('user_id', userId);
    await adminClient.from('profiles').delete().eq('user_id', userId);

    await writeAuditLog(adminClient, {
      action: 'user_deleted',
      category: 'users',
      success: true,
      userId: caller.id,
      userEmail: caller.email ?? null,
      targetTable: 'profiles',
      targetId: userId,
      details: { deleted_user_id: userId, deleted_role: targetRole?.role ?? null },
    });

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
