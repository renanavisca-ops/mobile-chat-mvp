import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const status: string | undefined = body?.status;
    // assigned_to: a user id to assign the chat to, or null to unassign.
    const hasAssignee = Object.prototype.hasOwnProperty.call(body ?? {}, 'assigned_to');
    const assignedTo: string | null = body?.assigned_to ?? null;

    // Validar el status si viene.
    if (status !== undefined && !['open', 'in_progress', 'closed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    if (status === undefined && !hasAssignee) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const supabase = supabaseAdmin;
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Perfil del usuario + datos del chat.
    const [{ data: profile }, { data: chat }] = await Promise.all([
      supabase.from('profiles').select('role, store_id').eq('id', user.id).single(),
      supabase.from('chats').select('store_id, assigned_to').eq('id', id).single()
    ]);

    if (!profile || !chat) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Permisos: superadmin siempre; admin de la tienda; agente de la tienda si
    // el chat está sin asignar o ya es suyo (así puede tomar chats nuevos).
    let allowed = false;
    if (profile.role === 'superadmin') {
      allowed = true;
    } else if (profile.role === 'admin') {
      allowed = profile.store_id === chat.store_id;
    } else if (profile.role === 'agent') {
      allowed = profile.store_id === chat.store_id &&
        ((chat as any).assigned_to === user.id || (chat as any).assigned_to == null);
    }
    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Si se asigna a alguien, ese alguien debe ser staff de la misma tienda.
    if (hasAssignee && assignedTo) {
      const { data: target } = await supabase
        .from('profiles').select('role, store_id').eq('id', assignedTo).single();
      const okTarget = target &&
        (target as any).store_id === chat.store_id &&
        ['agent', 'admin', 'superadmin'].includes((target as any).role);
      if (!okTarget) {
        return NextResponse.json({ error: 'Invalid assignee' }, { status: 400 });
      }
    }

    const patch: Record<string, unknown> = {};
    if (status !== undefined) patch.status = status;
    if (hasAssignee) patch.assigned_to = assignedTo;

    const { error } = await (supabase as any).from('chats').update(patch).eq('id', id);
    if (error) throw error;

    return NextResponse.json({ ok: true });

  } catch (error: any) {
    console.error('Error updating status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
