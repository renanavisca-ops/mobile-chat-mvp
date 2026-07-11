import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, phone, country } = body;

    if (!name || !phone || !country || !['GT', 'CR'].includes(country)) {
      return NextResponse.json({ error: 'Name, phone, and valid country are required' }, { status: 400 });
    }

    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('id')
      .eq('country', country)
      .eq('active', true)
      .limit(1)
      .single();

    if (storeError || !store) {
      return NextResponse.json({ error: 'No active store found for this country' }, { status: 404 });
    }

    const { data: agents } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('store_id', store.id)
      .eq('role', 'agent')
      .order('id', { ascending: true });

    const { data: lastChats } = await supabaseAdmin
      .from('chats')
      .select('assigned_to, created_at')
      .eq('store_id', store.id)
      .not('assigned_to', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    let assignedAgentId = null;

    if (agents && agents.length > 0) {
      const lastAssignedId = lastChats?.[0]?.assigned_to;

      if (!lastAssignedId) {
        assignedAgentId = agents[0].id;
      } else {
        const lastIndex = agents.findIndex((a: any) => a.id === lastAssignedId);
        assignedAgentId = lastIndex === -1 ? agents[0].id : agents[(lastIndex + 1) % agents.length].id;
      }
    }

    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .insert({ name, phone, country })
      .select('id')
      .single();

    if (customerError || !customer) {
      throw new Error('Failed to create customer');
    }

    const { data: chat, error: chatError } = await supabaseAdmin
      .from('chats')
      .insert({
        kind: 'customer',
        title: `${name} (${phone})`,
        store_id: store.id,
        assigned_to: assignedAgentId,
        created_by: null,
        status: 'open',
      } as any)
      .select('id')
      .single();

    if (chatError || !chat) throw chatError;

    const publicToken = crypto.randomBytes(32).toString('hex');
    const { error: sessionError } = await supabaseAdmin
      .from('customer_chat_sessions')
      .insert({
        customer_id: customer.id,
        chat_id: chat.id,
        public_token: publicToken,
      });

    if (sessionError) throw sessionError;

    const initialContent = 'Cliente inició conversación';
    const ciphertext = JSON.stringify({ v: 1, text: initialContent });

    const { error: msgError } = await supabaseAdmin
      .from('messages')
      .insert({
        chat_id: chat.id,
        content: initialContent,
        ciphertext,
        message_type: 'system',
        sender_type: 'system',
        sender_device_id: null,
        nonce: crypto.randomUUID(),
        read: false,
      } as any);

    if (msgError) throw msgError;

    return NextResponse.json({
      chat_id: chat.id,
      token: publicToken,
      customer_id: customer.id,
    });
  } catch (error: any) {
    console.error('Error in /api/chat/start:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
