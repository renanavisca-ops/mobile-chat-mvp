import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { status } = await req.json();

    // 1. Validar status permitido
    if (!['open', 'in_progress', 'closed'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // 2. Obtener usuario autenticado (desde el cliente pasaremos la sesión si fuera necesario, 
    // pero aquí usaremos el token de la request si está disponible o una validación manual)
    // Para simplificar y seguir el flujo del proyecto, buscaremos el usuario.
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

    // 3. Obtener perfil del usuario y datos del chat
    const [{ data: profile }, { data: chat }] = await Promise.all([
      supabase.from('profiles').select('role, store_id').eq('id', user.id).single(),
      supabase.from('chats').select('store_id, assigned_to').eq('id', id).single()
    ]);

    if (!profile || !chat) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 4. Validar permisos por rol
    let allowed = false;
    if (profile.role === 'superadmin') {
      allowed = true;
    } else if (profile.role === 'admin') {
      allowed = profile.store_id === chat.store_id;
    } else if (profile.role === 'agent') {
      allowed = chat.assigned_to === user.id;
    }

    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 5. Actualizar status
    const { error } = await supabase
      .from('chats')
      .update({ status })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ ok: true });

  } catch (error: any) {
    console.error('Error updating status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
