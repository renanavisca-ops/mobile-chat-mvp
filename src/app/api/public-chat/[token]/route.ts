import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import crypto from 'crypto';

export async function GET(req: Request, { params }: { params: { token: string } }) {
  try {
    const token = params.token;
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // 1. Validar token
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('customer_chat_sessions')
      .select('chat_id, customer_id, customers(name, phone, country), chats(title, status)')
      .eq('public_token', token)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
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
      messages: (messages || []).reverse()
    });

  } catch (error: any) {
    console.error('Error in GET /api/public-chat/[token]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  try {
    const token = params.token;
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const payload = await req.json();

    // 1. Validar token
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('customer_chat_sessions')
      .select('chat_id, customer_id')
      .eq('public_token', token)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 2. Guardar mensaje
    // sender_device_id debe permitir null para mensajes enviados desde chat público sin auth/device local.
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
        sender_device_id: null,
        nonce,
        read: false
      } as any)
      .select()
      .single();

    if (msgError) throw msgError;

    return NextResponse.json(msg);

  } catch (error: any) {
    console.error('Error in POST /api/public-chat/[token]:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
