import { describe, expect, it } from 'vitest'
import { renderIdentityChangeEmail } from './identity-change-notice'

const base = {
  userId: '00000000-0000-0000-0000-000000000000',
  changedAt: '2026-10-06T08:30:00.000Z',
  recipients: ['old@example.com'],
}

describe('renderIdentityChangeEmail', () => {
  it('renders masked phone values in all three languages with the WhatsApp link', () => {
    const { subject, html } = renderIdentityChangeEmail({
      ...base,
      kind: 'phone',
      oldMasked: '+852 •••• 4212',
      newMasked: '+852 •••• 9988',
    })
    expect(subject).toContain('電話號碼')
    expect(html).toContain('+852 •••• 4212')
    expect(html).toContain('+852 •••• 9988')
    expect(html).toContain('如非本人操作，請立即聯絡客服')
    expect(html).toContain('如非本人操作，请立即联系客服')
    expect(html).toContain('If this was not you')
    expect(html).toContain('https://wa.me/')
    expect(html).toContain('16:30') // HKT
  })

  it('escapes values and omits the previous row when there was none', () => {
    const { html } = renderIdentityChangeEmail({
      ...base,
      kind: 'email',
      oldMasked: null,
      newMasked: '<b>x</b>•••@example.com',
    })
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(html).not.toContain('原有')
  })
})
