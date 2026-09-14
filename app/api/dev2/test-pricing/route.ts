// Dev2 Panel: Set UAT Test Pricing
// Updates uat_test_pricing table (admin-only)

import { NextRequest, NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const admin = await getAdminData()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { mode, amount, label } = body

    if (!mode || !['flat', 'per_hour'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode: must be flat or per_hour' }, { status: 400 })
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum < 0) {
      return NextResponse.json({ error: 'Invalid amount: must be >= 0' }, { status: 400 })
    }

    const service = getServiceSupabase()

    // Call the set_uat_test_price() function (deactivates old, activates new)
    const { data: newPrice, error } = await service.rpc('set_uat_test_price', {
      p_mode: mode,
      p_amount: amountNum,
      p_label: label || null,
      p_updated_by: admin.userId,
    })

    if (error) throw error

    // Write audit log
    await service.from('audit_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action: 'set_uat_test_price',
      target_table: 'uat_test_pricing',
      target_id: newPrice.id,
      before_value: null,
      after_value: {
        mode: newPrice.mode,
        amount: newPrice.amount,
        label: newPrice.label,
      },
    })

    return NextResponse.json({
      success: true,
      price: {
        id: newPrice.id,
        mode: newPrice.mode,
        amount: newPrice.amount,
        label: newPrice.label,
      },
    })
  } catch (error) {
    console.error('[dev2/test-pricing] error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
