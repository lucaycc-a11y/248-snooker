// Script to verify and fix pricing time range inconsistency
import { getLegacyServiceSupabase } from '../lib/supabase/legacy'

async function main() {
  const supabase = getLegacyServiceSupabase()

  console.log('=== CHECKING DATABASE PRICING CONFIG ===\n')

  const { data, error } = await supabase
    .from('config')
    .select('key, value')
    .eq('key', 'pricing')
    .maybeSingle()

  if (error) {
    console.error('Error fetching config:', error)
    process.exit(1)
  }

  if (!data) {
    console.log('❌ No pricing config found in database')
    console.log('   This means the migration 20260714_pricing_2026_rates.sql has NOT been run yet.\n')
    console.log('RECOMMENDATION: Run the migration to populate the database.')
    return
  }

  console.log('✓ Pricing config exists in database')
  console.log('\nCurrent database periods:')

  if (data.value?.periods) {
    data.value.periods.forEach((p: any) => {
      console.log(`  ${p.id.padEnd(10)} ${p.start}-${p.end}  HK$${p.rate}`)
    })
  }

  console.log('\n=== EXPECTED TIME RANGES (from code) ===')
  console.log('  morning    06:00-12:00  HK$88')
  console.log('  afternoon  12:00-18:00  HK$98')
  console.log('  evening    18:00-24:00  HK$108')

  // Check for the inconsistency
  const afternoonPeriod = data.value?.periods?.find((p: any) => p.id === 'afternoon')

  if (afternoonPeriod) {
    if (afternoonPeriod.end === '16:00') {
      console.log('\n❌ INCONSISTENCY DETECTED:')
      console.log('   Database has afternoon ending at 16:00')
      console.log('   Code expects afternoon ending at 18:00')
      console.log('\nThis means:')
      console.log('   - Times 16:00-18:00 may be incorrectly priced')
      console.log('   - Tests expect 18:00 but database has 16:00')
    } else if (afternoonPeriod.end === '18:00') {
      console.log('\n✓ Database is correct (afternoon ends at 18:00)')
    } else {
      console.log(`\n⚠️  Unexpected afternoon end time: ${afternoonPeriod.end}`)
    }
  }
}

main().catch(console.error)
