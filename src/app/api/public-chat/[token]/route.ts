import { NextResponse } from 'next/server';
import { reportServerError } from '@/lib/observability';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: Request, { params }: { params: { token: string } }) {
  try {
    const token = params.token;
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // 1. Validar token
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('customer_chat_sessions')
      .select('chat_id, customer_id, customers(name, phone, country), chats(title, status, store_id)')
      .eq('public_token', token)
      .single();

    if (sessionError || !session || !session.chat_id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 1b. Perfil comercial de la tienda, para mostrárselo al cliente.
    let store = null;
    const storeId = (session as any)?.chats?.store_id;
    if (storeId) {
      const { data: s } = await supabaseAdmin
        .from('stores')
        .select('id, name, category, about, address, website, phone, business_hours')
        .eq('id', storeId)
        .single();
      if (s) store = s;
    }

    // 1c. Catálogo visible de la tienda (con URL pública de la imagen).
    let products: any[] = [];
    if (storeId) {
      const { data: rows } = await (supabaseAdmin as any)
        .from('store_products')
        .select('id, name, description, price, image_path, sort')
        .eq('store_id', storeId)
        .eq('active', true)
        .order('sort', { ascending: true })
        .order('created_at', { ascending: true });
      products = (rows || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        price: r.price,
        image_url: r.image_path
          ? supabaseAdmin.storage.from('catalog').getPublicUrl(r.image_path).data.publicUrl
          : null,
      }));
    }

    // 2. Obtener mensajes recientes
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('id, chat_id, sender_device_id, ciphertext, nonce, message_type, created_at, read, content, sender_type, sender_id, delivery_status')
      .eq('chat_id', session.chat_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (messagesError) throw messagesError;

    return NextResponse.json({
      session,
      store,
      products,
      messages: (messages || []).reverse()
    });

  } catch (error: any) {
    console.error('Error in GET /api/public-chat/[token]:', error);
    reportServerError(error, { route: 'public-chat/GET' });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const token = params.token;
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // Anti-spam: cap how fast a single customer session can post (20 / minute).
    // Fail open — a limiter error must never block a legitimate conversation.
    try {
      const { data: allowed } = await (supabaseAdmin as any).rpc('rate_limit_hit', {
        p_bucket: `public-chat:${token}`,
        p_limit: 20,
        p_window_seconds: 60,
      });
      if (allowed === false) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      }
    } catch {
      // limiter unavailable — allow the message through
    }

    const payload = await req.json();

    // 1. Validar token
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('customer_chat_sessions')
      .select('chat_id, customer_id, chats(store_id)')
      .eq('public_token', token)
      .single();

    if (sessionError || !session || !session.chat_id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 2a. ¿Es el primer mensaje del cliente? (para la bienvenida automática)
    const { count: priorCustomer } = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('chat_id', session.chat_id)
      .eq('sender_type', 'customer');
    const isFirstCustomerMessage = (priorCustomer ?? 0) === 0;

    // 2b. Guardar el mensaje del cliente
    const ciphertext = JSON.stringify({ v: 1, ...payload });
    const content = payload.text || null;
    const nonce = crypto.randomUUID();

    const { data: msg, error: msgError } = await supabaseAdmin
      .from('messages')
      .insert({
        chat_id: session.chat_id,
        content,
        ciphertext,
        message_type: 'whisper',
        sender_type: 'customer',
        sender_id: session.customer_id,
        nonce,
        read: false
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // 3. Mensajes automáticos de la tienda (bienvenida / ausencia).
    const storeId = (session as any)?.chats?.store_id;
    if (storeId) {
      const { data: s } = await (supabaseAdmin as any)
        .from('stores')
        .select('welcome_message, away_message, away_active')
        .eq('id', storeId)
        .single();
      const insertAuto = async (text: string) => {
        try {
          await (supabaseAdmin as any).from('messages').insert({
            chat_id: session.chat_id,
            content: text,
            ciphertext: JSON.stringify({ v: 1, text }),
            message_type: 'whisper',
            sender_type: 'agent',
            sender_id: null,
            nonce: crypto.randomUUID(),
            read: false,
          });
        } catch { /* best effort — never fail the customer's send */ }
      };
      if (s) {
        if (isFirstCustomerMessage && s.welcome_message) await insertAuto(s.welcome_message);
        if (s.away_active && s.away_message) await insertAuto(s.away_message);
      }
    }

    return NextResponse.json(msg);

  } catch (error: any) {
    console.error('Error in POST /api/public-chat/[token]:', error);
    reportServerError(error, { route: 'public-chat/POST' });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
