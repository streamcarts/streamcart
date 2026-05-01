// Triggered by DB webhook when a new order is inserted.
// Sends "new order" email to the seller + all admins.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrderRecord {
  id: string
  buyer_id: string
  seller_id: string
  service_name: string
  total_paid: number | string
  seller_earning: number | string
  admin_commission: number | string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    const payload = await req.json()
    const order: OrderRecord = payload.record ?? payload.order ?? payload
    if (!order?.id || !order?.seller_id) {
      return json({ error: 'missing order fields' }, 400)
    }

    // Resolve seller email
    const { data: sellerUser } = await admin.auth.admin.getUserById(order.seller_id)
    const sellerEmail = sellerUser?.user?.email ?? null

    // Resolve buyer email
    const { data: buyerUser } = await admin.auth.admin.getUserById(order.buyer_id)
    const buyerEmail = buyerUser?.user?.email ?? null

    // Resolve seller display name
    const { data: sellerProfile } = await admin
      .from('profiles').select('display_name').eq('id', order.seller_id).maybeSingle()

    // Resolve admin user_ids
    const { data: adminRoles } = await admin
      .from('user_roles').select('user_id').eq('role', 'admin')
    const adminIds: string[] = (adminRoles ?? []).map((r: any) => r.user_id)

    const adminEmails: string[] = []
    for (const uid of adminIds) {
      const { data: u } = await admin.auth.admin.getUserById(uid)
      if (u?.user?.email) adminEmails.push(u.user.email)
    }

    const results: Record<string, unknown> = {}

    // Send to seller
    if (sellerEmail) {
      const r = await admin.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'new-order-seller',
          recipientEmail: sellerEmail,
          idempotencyKey: `new-order-seller-${order.id}`,
          templateData: {
            sellerName: (sellerProfile as any)?.display_name ?? null,
            productName: order.service_name,
            orderId: order.id,
            amount: order.total_paid,
            earning: order.seller_earning,
            buyerEmail,
          },
        },
      })
      results.seller = r.error?.message ?? 'ok'
    }

    // Send to each admin
    const adminResults: string[] = []
    for (const adminEmail of adminEmails) {
      const r = await admin.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'new-order-admin',
          recipientEmail: adminEmail,
          idempotencyKey: `new-order-admin-${order.id}-${adminEmail}`,
          templateData: {
            productName: order.service_name,
            orderId: order.id,
            amount: order.total_paid,
            commission: order.admin_commission,
            sellerEmail,
            buyerEmail,
          },
        },
      })
      adminResults.push(r.error?.message ?? 'ok')
    }
    results.admins = adminResults

    return json({ ok: true, results })
  } catch (e) {
    console.error('notify-new-order error', e)
    return json({ ok: false, error: e instanceof Error ? e.message : 'unknown' }, 200)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
