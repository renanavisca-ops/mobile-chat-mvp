import { NextResponse } from 'next/server';
import { reportServerError } from '@/lib/observability';
import { matchingRules } from '@/lib/automations/match';
import { recordIntegrationEvent } from '@/lib/integrations/dispatch';
import { classifyConsentKeyword } from '@/lib/campaigns/optout';
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

    // Pedido desde el catálogo (§12). El cliente envía {action:'order', items:
    // [{productId, qty}], note?}. Se validan los productos contra el catálogo de
    // la tienda (precio/título se congelan), se crea el pedido y se publica un
    // resumen en el chat para el agente. Nunca confía en precios del cliente.
    if (payload?.action === 'order') {
      const orderStoreId = (session as any)?.chats?.store_id;
      if (!orderStoreId) return NextResponse.json({ error: 'No store' }, { status: 400 });
      const rawItems: { productId?: string; qty?: number }[] = Array.isArray(payload.items) ? payload.items : [];
      const wanted = new Map<string, number>();
      for (const it of rawItems) {
        if (!it?.productId) continue;
        const q = Math.max(1, Math.min(99, Math.floor(Number(it.qty) || 1)));
        wanted.set(it.productId, (wanted.get(it.productId) ?? 0) + q);
      }
      if (wanted.size === 0) return NextResponse.json({ error: 'Empty order' }, { status: 400 });

      const { data: prods } = await (supabaseAdmin as any)
        .from('store_products')
        .select('id, name, price, active')
        .eq('store_id', orderStoreId)
        .in('id', Array.from(wanted.keys()));
      const valid = ((prods as any[]) || []).filter((p) => p.active !== false);
      if (valid.length === 0) return NextResponse.json({ error: 'No valid products' }, { status: 400 });

      const note = typeof payload.note === 'string' ? payload.note.trim().slice(0, 500) : null;
      const { data: order, error: orderErr } = await (supabaseAdmin as any)
        .from('orders')
        .insert({ store_id: orderStoreId, chat_id: session.chat_id, customer_id: session.customer_id, status: 'pending', note })
        .select('id')
        .single();
      if (orderErr) throw orderErr;

      const itemsToInsert = valid.map((p) => ({
        order_id: order.id,
        product_id: p.id,
        title: p.name,
        price: p.price ?? null,
        qty: wanted.get(p.id) ?? 1,
      }));
      await (supabaseAdmin as any).from('order_items').insert(itemsToInsert);

      // Resumen legible publicado en el chat como mensaje del cliente.
      const lines = itemsToInsert.map((it) => `• ${it.qty}× ${it.title}${it.price ? ` (${it.price})` : ''}`);
      const summary = `🛒 Pedido:\n${lines.join('\n')}${note ? `\n\n📝 ${note}` : ''}`;
      const { data: orderMsg } = await (supabaseAdmin as any)
        .from('messages')
        .insert({
          chat_id: session.chat_id,
          content: summary,
          ciphertext: JSON.stringify({ v: 1, text: summary, order_id: order.id }),
          message_type: 'whisper',
          sender_type: 'customer',
          sender_id: session.customer_id,
          nonce: crypto.randomUUID(),
          read: false,
        })
        .select()
        .single();

      try {
        await recordIntegrationEvent(supabaseAdmin, orderStoreId, 'support.order_placed', {
          chatId: session.chat_id, orderId: order.id, itemCount: itemsToInsert.length,
        });
      } catch { /* best-effort */ }

      return NextResponse.json({ ok: true, orderId: order.id, message: orderMsg });
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

      // 4. Automatizaciones por palabra clave. Solo sobre el texto plano del
      //    cliente (los chats E2EE nunca pasan por aquí). Controles: evaluamos
      //    únicamente el mensaje entrante del cliente (no de agente/sistema), la
      //    respuesta se inserta como 'agent' (no re-dispara reglas → sin bucles),
      //    y un limitador evita duplicados (máx. 1 activación por regla/chat/2min).
      if (content) {
        try {
          const { data: rules } = await (supabaseAdmin as any)
            .from('automation_rules')
            .select('id, enabled, match_type, keywords, case_sensitive, action_reply, action_label_id')
            .eq('store_id', storeId)
            .eq('enabled', true)
            .order('sort', { ascending: true });
          const mapped = ((rules as any[]) || []).map((r) => ({
            id: r.id as string,
            enabled: true,
            matchType: r.match_type,
            keywords: Array.isArray(r.keywords) ? r.keywords : [],
            caseSensitive: !!r.case_sensitive,
            actionReply: r.action_reply as string | null,
            actionLabelId: r.action_label_id as string | null,
          }));
          for (const rule of matchingRules(content, mapped)) {
            let allow = true;
            try {
              const { data: ok } = await (supabaseAdmin as any).rpc('rate_limit_hit', {
                p_bucket: `auto:${session.chat_id}:${rule.id}`, p_limit: 1, p_window_seconds: 120,
              });
              allow = ok !== false;
            } catch { allow = true; }
            if (!allow) continue;
            if (rule.actionReply) await insertAuto(rule.actionReply);
            if (rule.actionLabelId) {
              try {
                await (supabaseAdmin as any).from('chat_labels')
                  .upsert({ chat_id: session.chat_id, label_id: rule.actionLabelId }, { onConflict: 'chat_id,label_id', ignoreDuplicates: true });
              } catch { /* etiqueta best-effort */ }
            }
          }
        } catch { /* automatizaciones best-effort — nunca rompen el envío */ }
      }

      // Consentimiento de campañas por palabra clave (opt-in / opt-out). La baja
      // siempre se respeta; el alta es un opt-in explícito del cliente. Se graba
      // en store_customer_consent (por tienda-cliente) y se confirma al cliente.
      if (content && session.customer_id) {
        const signal = classifyConsentKeyword(content);
        if (signal) {
          try {
            const optedOut = signal === 'opt_out';
            await (supabaseAdmin as any).from('store_customer_consent').upsert({
              store_id: storeId,
              customer_id: session.customer_id,
              consent: !optedOut,
              opted_out_at: optedOut ? new Date().toISOString() : null,
              source: 'keyword',
              updated_at: new Date().toISOString(),
            }, { onConflict: 'store_id,customer_id' });
            await insertAuto(optedOut
              ? 'Listo: no recibirás más comunicaciones de difusión. Responde ALTA para volver a suscribirte.'
              : '¡Gracias! Quedaste suscrito a nuestras comunicaciones. Responde BAJA para cancelar en cualquier momento.');
            await recordIntegrationEvent(supabaseAdmin, storeId,
              optedOut ? 'support.consent_opt_out' : 'support.consent_opt_in',
              { customerId: session.customer_id });
          } catch { /* best-effort — nunca rompe el envío del cliente */ }
        }
      }

      // Integraciones (outbox): evento no sensible — nunca el contenido.
      await recordIntegrationEvent(supabaseAdmin, storeId, 'support.message_received', {
        chatId: session.chat_id, messageId: (msg as any)?.id, hasText: !!content,
      });
    }

    return NextResponse.json(msg);

  } catch (error: any) {
    console.error('Error in POST /api/public-chat/[token]:', error);
    reportServerError(error, { route: 'public-chat/POST' });
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
