// Temporary script to check database pricing configuration
import { getLegacyServiceSupabase } from '../lib/supabase/legacy'

async function main() {
  const supabase = getLegacyServiceSupabase()

  const { data, error } = await supabase
    .from('config')
    .select('key, value')
    .eq('key', 'pricing')
    .single()

  if (error) {
    console.error('Error fetching config:', error)
    process.exit(1)
  }

  console.log('Database pricing config:')
  console.log(JSON.stringify(data.value, null, 2))

  if (data.value?.periods) {
    console.log('\n=== PERIODS BREAKDOWN ===')
    data.value.periods.forEach((p: any) => {
      console.log(`${p.id}: ${p.start}-${p.end} @ HK$${p.rate}`)
    })
  }
}

main().catch(console.error)
