#!/usr/bin/env tsx
/**
 * Part 3: Backfill 現有用戶電話落 auth.users.phone
 *
 * 關鍵步驟:將 public.users.phone 同步到 auth.users.phone
 * 防止現有用戶登入時被當做新用戶,創建重複帳戶
 *
 * 執行前檢查:
 * 1. 確認 public.users 和 auth.users 的關聯方式
 * 2. 檢查是否有電話衝突 (同一電話對應多個用戶)
 * 3. 預覽將要更新的記錄
 *
 * 執行:
 *   npx tsx scripts/backfill-auth-phones.ts
 */

import { getServiceSupabase } from '@/lib/supabase/service'

async function main() {
  console.log('🔍 Part 3: Backfill 現有用戶電話')
  console.log('═'.repeat(60))

  const supabase = getServiceSupabase()

  // Step 1: 檢查 public.users 和 auth.users 的關聯方式
  console.log('\n📋 Step 1: 檢查資料庫結構...')

  const { data: sampleUsers, error: sampleError } = await supabase
    .from('users')
    .select('id, phone, email')
    .limit(3)

  if (sampleError) {
    console.error('❌ 無法查詢 public.users:', sampleError.message)
    process.exit(1)
  }

  console.log(`✅ public.users 結構確認 (sample ${sampleUsers?.length ?? 0} 行)`)

  // Step 2: 查詢有已驗證電話但 auth.users.phone 係空的用戶
  console.log('\n📋 Step 2: 查詢需要 backfill 的用戶...')

  const { data: usersToBackfill, error: queryError } = await supabase
    .from('users')
    .select('id, phone, email, display_name')
    .not('phone', 'is', null)
    .neq('phone', '')

  if (queryError) {
    console.error('❌ 查詢失敗:', queryError.message)
    process.exit(1)
  }

  console.log(`📊 找到 ${usersToBackfill?.length ?? 0} 個有電話的用戶`)

  if (!usersToBackfill || usersToBackfill.length === 0) {
    console.log('✅ 沒有需要 backfill 的用戶')
    return
  }

  // Step 3: 檢查每個用戶在 auth.users 的 phone 狀態
  console.log('\n📋 Step 3: 檢查 auth.users.phone 狀態...')

  let needsBackfill = 0
  let alreadyFilled = 0
  const toUpdate: Array<{ id: string; phone: string; name: string }> = []

  for (const user of usersToBackfill) {
    const { data: authUser } = await supabase.auth.admin.getUserById(user.id)

    if (!authUser.user) {
      console.warn(`⚠️  用戶 ${user.id} 在 auth.users 找不到`)
      continue
    }

    if (authUser.user.phone && authUser.user.phone === user.phone) {
      alreadyFilled++
      continue
    }

    needsBackfill++
    toUpdate.push({
      id: user.id,
      phone: user.phone,
      name: user.display_name || user.email || 'Unknown',
    })
  }

  console.log(`📊 統計:`)
  console.log(`   - 需要 backfill: ${needsBackfill}`)
  console.log(`   - 已經正確: ${alreadyFilled}`)

  if (toUpdate.length === 0) {
    console.log('\n✅ 所有用戶電話已正確,無需 backfill')
    return
  }

  // Step 4: 檢查電話衝突
  console.log('\n📋 Step 4: 檢查電話衝突...')

  const phoneMap = new Map<string, number>()
  for (const user of toUpdate) {
    phoneMap.set(user.phone, (phoneMap.get(user.phone) || 0) + 1)
  }

  const conflicts = Array.from(phoneMap.entries()).filter(([_, count]) => count > 1)

  if (conflicts.length > 0) {
    console.error('\n❌❌❌ 發現電話衝突! ❌❌❌')
    console.error('以下電話被多個用戶使用:')
    for (const [phone, count] of conflicts) {
      console.error(`   ${phone}: ${count} 個用戶`)
      const conflictUsers = toUpdate.filter(u => u.phone === phone)
      for (const u of conflictUsers) {
        console.error(`      - ${u.id} (${u.name})`)
      }
    }
    console.error('\n⚠️  必須手動解決衝突後才能繼續!')
    console.error('請聯絡 Luca 決定如何處理這些重複帳戶')
    process.exit(1)
  }

  console.log('✅ 沒有電話衝突')

  // Step 5: 預覽將要更新的記錄
  console.log('\n📋 Step 5: 預覽將要更新的用戶:')
  console.log('─'.repeat(60))

  for (const user of toUpdate.slice(0, 10)) {
    console.log(`   ${user.name}`)
    console.log(`   ID: ${user.id}`)
    console.log(`   電話: ${user.phone.replace(/\d{4}$/, '****')}`)
    console.log('')
  }

  if (toUpdate.length > 10) {
    console.log(`   ... 還有 ${toUpdate.length - 10} 個用戶`)
  }

  // Step 6: 執行 backfill
  console.log('\n📋 Step 6: 執行 backfill...')
  console.log('⚠️  即將更新 auth.users.phone...')

  // 等待用戶確認 (在腳本執行時需要手動確認)
  // 生產環境可以加入互動式確認

  let successCount = 0
  let errorCount = 0
  const errors: Array<{ id: string; phone: string; error: string }> = []

  for (const user of toUpdate) {
    try {
      const { error } = await supabase.auth.admin.updateUserById(user.id, {
        phone: user.phone,
        phone_confirm: true,
      })

      if (error) {
        console.error(`❌ 更新失敗 ${user.id}: ${error.message}`)
        errorCount++
        errors.push({ id: user.id, phone: user.phone, error: error.message })
      } else {
        console.log(`✅ 已更新 ${user.name} (${user.phone.replace(/\d{4}$/, '****')})`)
        successCount++
      }
    } catch (error) {
      console.error(`❌ 異常 ${user.id}:`, error)
      errorCount++
      errors.push({
        id: user.id,
        phone: user.phone,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Step 7: 總結
  console.log('\n═'.repeat(60))
  console.log('📊 Backfill 完成總結')
  console.log('═'.repeat(60))
  console.log(`✅ 成功: ${successCount}`)
  console.log(`❌ 失敗: ${errorCount}`)
  console.log(`📊 總計: ${toUpdate.length}`)

  if (errors.length > 0) {
    console.log('\n❌ 失敗記錄:')
    for (const err of errors) {
      console.log(`   ${err.id} (${err.phone}): ${err.error}`)
    }
  }

  // Step 8: 驗證
  console.log('\n📋 Step 8: 驗證 backfill 結果...')

  const { data: verifyUsers } = await supabase
    .from('users')
    .select('id, phone')
    .not('phone', 'is', null)
    .neq('phone', '')

  let verifiedCount = 0
  for (const user of verifyUsers || []) {
    const { data: authUser } = await supabase.auth.admin.getUserById(user.id)
    if (authUser.user?.phone === user.phone) {
      verifiedCount++
    }
  }

  console.log(`✅ 驗證: ${verifiedCount}/${verifyUsers?.length ?? 0} 個用戶電話已同步`)

  if (errorCount > 0) {
    console.log('\n⚠️  有錯誤發生,請檢查上面的失敗記錄')
    process.exit(1)
  }

  console.log('\n✅ Part 3 完成!')
  console.log('下一步: Part 4 - 前端遷移到 Supabase 原生 auth')
}

main().catch((error) => {
  console.error('💥 腳本執行失敗:', error)
  process.exit(1)
})
