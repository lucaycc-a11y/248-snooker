import type { HelpArticleContent } from './types'

export const specialWeatherEn: HelpArticleContent = {
  title: 'Severe Weather Policy',
  intro: 'Understand booking arrangements during Typhoon Signal 8+ or Black Rainstorm Warning periods.',
  sections: [
    {
      title: 'Venue Operations',
      content: [
        'Space8 is an indoor facility and will remain open during Typhoon Signal 8 or Black Rainstorm Warning periods.',
        '',
        'If you assess the weather conditions as safe, you may still proceed to use your booked time slot.',
        {
          type: 'callout',
          variant: 'info',
          text: 'The venue will remain open, but we understand that going outside during severe weather may pose risks. Members may decide for themselves whether to attend.',
        },
      ],
    },
    {
      title: 'Rescheduling Arrangement for Inability to Attend',
      content: [
        'If you are unable to attend due to weather safety concerns, you may request to reschedule:',
        '',
        '**Conditions:**',
        '• Submit a rescheduling request via WhatsApp 6180 8022 **before** your booking start time',
        '• A Typhoon Signal 8 or above, or Black Rainstorm Warning, must be in effect at that time',
        '',
        '**Rescheduling Entitlement:**',
        'After verification by the Company\'s system, you may rebook an equivalent-value time slot **within 7 days**.',
        {
          type: 'callout',
          variant: 'warning',
          text: 'Please note: Requests must be submitted before the booking start time. Rescheduling requests will not be accepted after the booking time slot has begun.',
        },
      ],
    },
    {
      title: 'Rescheduling Request Process',
      content: [
        '1. Before your booking start time, contact customer service via WhatsApp 6180 8022',
        '2. Provide your order number (format: SPACE8-XXXXX-C)',
        '3. Explain that you are unable to attend due to severe weather',
        '4. The Company will verify the weather warning status at that time',
        '5. After verification, you will receive a 7-day rescheduling window',
        '6. Rebook a new time slot within 7 days',
      ],
    },
    {
      title: 'Important Notes',
      content: [
        '• This is a **rescheduling arrangement**, not a cash refund',
        '• You must reschedule to an equivalent-value time slot',
        '• After the 7-day rescheduling window expires, unused rescheduling entitlements will be forfeited',
        '• Rescheduling entitlements are non-transferable',
        '• If you have already arrived at the venue and used your QR code to enter, you will not be eligible for rescheduling',
      ],
    },
    {
      title: 'Other Weather Conditions',
      content: [
        'The following weather conditions are **not eligible** for rescheduling:',
        '• Typhoon Signal 3',
        '• Typhoon Signal 1',
        '• Yellow or Red Rainstorm Warning',
        '• Thunderstorm Warning',
        '• Very Hot Weather Warning',
        '• Other weather conditions',
        '',
        'Only Typhoon Signal 8 or above, or Black Rainstorm Warning, qualifies for the severe weather rescheduling policy.',
      ],
    },
  ],
}
