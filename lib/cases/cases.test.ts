import { describe, expect, it } from 'vitest'
import { renderCaseEmail, type CaseEmailData } from './email'
import { SCENARIOS, SCENARIO_LIST, isCaseScenario } from './scenarios'
import { validateCaseInput, type CreateCaseInput } from './service'

const base: CreateCaseInput = {
  userId: '00000000-0000-4000-8000-000000000001',
  scenario: 'smoking',
  detail: '於 2 號房內吸電子煙，CCTV 20:15–20:30',
  amount: 500,
  applyBlacklist: true,
}

describe('validateCaseInput', () => {
  it('accepts the standard smoking case', () => {
    expect(validateCaseInput(base)).toBeNull()
  })

  it('accepts a fee above the clause amount (actual cost) and a zero-fee warning', () => {
    expect(validateCaseInput({ ...base, amount: 800 })).toBeNull()
    expect(validateCaseInput({ ...base, scenario: 'pet', amount: 0, applyBlacklist: false })).toBeNull()
  })

  it('rejects a smoking fee below the HK$500 in the terms', () => {
    expect(validateCaseInput({ ...base, amount: 200 })).toMatch(/最低收費/)
  })

  it('rejects damage below HK$300', () => {
    expect(validateCaseInput({ ...base, scenario: 'damage', amount: 100 })).toMatch(/300/)
  })

  it('rejects amounts under the KPay minimum but above zero', () => {
    expect(validateCaseInput({ ...base, scenario: 'overtime', amount: 1 })).toMatch(/1\.5|最低/)
  })

  it('rejects negative, non-finite and oversized amounts', () => {
    expect(validateCaseInput({ ...base, amount: -5 })).not.toBeNull()
    expect(validateCaseInput({ ...base, amount: Number.NaN })).not.toBeNull()
    expect(validateCaseInput({ ...base, amount: 20001 })).toMatch(/上限/)
  })

  it('requires a real description and a sane due period', () => {
    expect(validateCaseInput({ ...base, detail: '吸煙' })).toMatch(/5/)
    expect(validateCaseInput({ ...base, dueDays: 0 })).not.toBeNull()
    expect(validateCaseInput({ ...base, dueDays: 90 })).not.toBeNull()
    expect(validateCaseInput({ ...base, dueDays: 7 })).toBeNull()
  })
})

describe('scenarios', () => {
  it('matches the amounts written in the venue terms', () => {
    expect(SCENARIOS.smoking.defaultAmount).toBe(500)
    expect(SCENARIOS.smoking.applyBlacklistByDefault).toBe(true)
    expect(SCENARIOS.damage.minChargeAmount).toBe(300)
  })

  it('keeps ids consistent with the registry', () => {
    for (const s of SCENARIO_LIST) expect(isCaseScenario(s.id)).toBe(true)
    expect(isCaseScenario('nope')).toBe(false)
  })
})

describe('renderCaseEmail', () => {
  const data: CaseEmailData = {
    to: 'a@example.com',
    memberName: '<b>陳</b>',
    caseNo: 'VC-261031-AB12',
    scenario: 'smoking',
    title: '吸煙／電子煙',
    detail: '第一行\n<script>alert(1)</script>',
    amount: 500,
    incidentAt: '2026-10-31T12:15:00.000Z',
    dueAt: '2026-11-07T12:00:00.000Z',
    payUrl: 'https://space8.com.hk/pay/case/token123',
    blacklisted: true,
  }

  it('notice carries the amount, case number, pay link and suspension line', () => {
    const { subject, html } = renderCaseEmail('notice', data)
    expect(subject).toContain('VC-261031-AB12')
    expect(html).toContain('HK$500')
    expect(html).toContain('https://space8.com.hk/pay/case/token123')
    expect(html).toContain('會員資格已被暫停')
  })

  it('escapes member-supplied values', () => {
    const { html } = renderCaseEmail('notice', data)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).not.toContain('<b>陳</b>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('a zero-fee warning has no pay button', () => {
    const { html } = renderCaseEmail('notice', { ...data, amount: 0, blacklisted: false })
    expect(html).not.toContain('前往繳付')
    expect(html).toContain('本次為警告')
  })

  it('receipt has no pay link and no suspension line', () => {
    const { html } = renderCaseEmail('paid', data)
    expect(html).not.toContain('前往繳付')
    expect(html).not.toContain('會員資格已被暫停')
    expect(html).toContain('已結案')
  })
})

import { buildCaseWhatsAppDraft, normalizeWhatsAppPhone, whatsAppLink } from './whatsapp'

describe('case whatsapp draft', () => {
  const base = { memberName: '陳大文', caseNo: 'VC-1', scenario: 'smoking' as const, title: '吸煙', amount: 500, dueAt: null, payUrl: 'https://x.test/pay/case/t', overdue: false }
  it('includes fee and pay link for a charge', () => {
    const t = buildCaseWhatsAppDraft(base)
    expect(t).toContain('HK$500')
    expect(t).toContain('https://x.test/pay/case/t')
  })
  it('has no pay link for a warning', () => {
    expect(buildCaseWhatsAppDraft({ ...base, amount: 0 })).not.toContain('pay/case')
  })
  it('normalizes HK phones', () => {
    expect(normalizeWhatsAppPhone('9123 4567')).toBe('85291234567')
    expect(normalizeWhatsAppPhone('+852 9123-4567')).toBe('85291234567')
    expect(normalizeWhatsAppPhone('12')).toBeNull()
    expect(whatsAppLink(null, 'a b')).toBe('https://wa.me/?text=a%20b')
  })
})

import { buildDemandLetter } from './demand-letter'

describe('demand letter', () => {
  it('states fee, deadline, pay link and tribunal warning', () => {
    const t = buildDemandLetter({ memberName: '陳大文', memberCode: 'M1', caseNo: 'VC-1', scenario: 'smoking', title: '吸煙', detail: null, incidentAt: null, amount: 500, payUrl: 'https://x.test/pay/case/t', now: new Date('2026-11-01T00:00:00Z') })
    expect(t).toContain('HK$500')
    expect(t).toContain('https://x.test/pay/case/t')
    expect(t).toContain('小額錢債審裁處')
    expect(t).toContain('2026年11月8日')
  })
})

describe('demand letter evidence', () => {
  it('includes terms acceptance time, clause text and booking code', () => {
    const t = buildDemandLetter({ memberName: '陳大文', memberCode: 'M1', caseNo: 'VC-1', scenario: 'smoking', title: '吸煙', detail: '洗手間有煙味', incidentAt: '2026-10-30T10:00:00Z', amount: 500, payUrl: 'https://x.test/p', bookingCode: 'B123', termsAcceptedAt: '2026-10-29T05:30:00Z', termsVersion: '2026-10-31', notifiedAt: '2026-10-31T01:00:00Z', now: new Date('2026-11-10T00:00:00Z') })
    expect(t).toContain('勾選同意')
    expect(t).toContain('2026-10-31')
    expect(t).toContain('預定損害賠償')
    expect(t).toContain('B123')
  })
  it('omits acceptance sentence when none on record', () => {
    const t = buildDemandLetter({ memberName: 'a', memberCode: null, caseNo: 'VC-1', scenario: 'other', title: 'x', detail: null, incidentAt: null, amount: 100, payUrl: 'u' })
    expect(t).not.toContain('勾選同意')
  })
})
