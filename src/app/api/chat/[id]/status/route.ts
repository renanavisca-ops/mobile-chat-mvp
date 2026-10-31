import { NextResponse } from 'next/server';
import { reportServerError } from '@/lib/observability';
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

    // Este endpoint es solo para chats de soporte (de una tienda). Rechazar
    // cualquier otro chat evita que store_id null coincida con store_id null y
    // deje pasar a usuarios comunes (todos tienen role 'agent' y store_id null).
    if (!chat.store_id) {
      return NextResponse.json({ error: 'Not a support chat' }, { status: 403 });
    }

    // Permisos: superadmin siempre; admin/agente SOLO de la misma tienda (con
    // store_id no nulo). El agente además solo si el chat está sin asignar o ya
    // es suyo (para poder tomar chats nuevos).
    let allowed = false;
    if (profile.role === 'superadmin') {
      allowed = true;
    } else if (profile.store_id && profile.store_id === chat.store_id) {
      if (profile.role === 'admin') {
        allowed = true;
      } else if (profile.role === 'agent') {
        allowed = (chat as any).assigned_to === user.id || (chat as any).assigned_to == null;
      }
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

    // Auditoría (best-effort): registrar la acción del staff sin romper la respuesta.
    try {
      const entries: any[] = [];
      if (status !== undefined) {
        entries.push({ store_id: chat.store_id, actor_id: user.id, action: 'chat_status', target_id: id, detail: { status } });
      }
      if (hasAssignee) {
        entries.push({ store_id: chat.store_id, actor_id: user.id, action: 'chat_assigned', target_id: id, detail: { assigned_to: assignedTo } });
      }
      if (entries.length) await (supabase as any).from('audit_log').insert(entries);
    } catch { /* no bloquear por telemetría */ }

    return NextResponse.json({ ok: true });

  } catch (error: any) {
    console.error('Error updating status:', error);
    reportServerError(error, { route: 'chat/status' });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
