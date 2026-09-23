import type { HelpArticleContent } from './types'

export const cancellationPolicyEn: HelpArticleContent = {
  title: 'Cancellation and Refund Policy',
  intro: 'Understand Space8\'s booking cancellation policy and refund processing procedures.',
  sections: [
    {
      title: 'Basic Principle',
      content: [
        'Once a booking is confirmed and payment is completed, cancellations and refunds are generally not accepted.',
        '',
        'If you need to cancel a booking, you must contact customer service:',
        '• WhatsApp: 6180 8022',
        '• Email: Admin@space8.com.hk',
        '• Order number format: SPACE8-XXXXX-C',
        {
          type: 'callout',
          variant: 'warning',
          text: 'Please note: Contacting customer service does not guarantee cancellation or refund approval, which depends on specific circumstances.',
        },
      ],
    },
    {
      title: 'Refunds in Special Circumstances',
      content: [
        'Members may be eligible for refunds in the following situations:',
        '',
        '**Payment Failure**',
        'If payment was not successfully completed, no charge occurred and no refund is needed.',
        '',
        '**Severe Weather (Typhoon Signal 8+ or Black Rainstorm Warning)**',
        'If a Typhoon Signal 8 or above, or a Black Rainstorm Warning, is issued during your booking time slot, you may request to reschedule within 7 days to an equivalent-value slot. Please note this is a rescheduling arrangement, not a cash refund. See the "Severe Weather Policy" article for details.',
        '',
        '**Company Cancellation**',
        'If the Company needs to cancel your booking for Company reasons (e.g., facility maintenance), you will receive a full refund or be provided with a compensatory time slot.',
      ],
    },
    {
      title: 'Refund Method and Required Time',
      content: [
        'If your refund request is approved, the refund will be processed as follows:',
        '',
        '1. The Company will submit refund instructions to the payment service provider within **3 business days** after verification',
        '2. The refund amount will be returned to your original payment method',
        '3. Depending on different payment methods and bank processing times, funds **generally take 5 to 14 business days** to reach your account',
        {
          type: 'callout',
          variant: 'info',
          text: 'Please note: These timeframes refer to refund processing time, not cancellation eligibility periods.',
        },
      ],
    },
    {
      title: 'Situations Not Eligible for Refund',
      content: [
        'The following situations are not eligible for refunds:',
        '• Simply changing your mind or schedule',
        '• Personal reasons for inability to attend',
        '• Being late or missing your booking time slot',
        '• Not fully utilizing your booking time slot',
      ],
    },
    {
      title: 'How to Apply for a Refund',
      content: [
        'If you believe you are eligible for a refund, please contact customer service:',
        '',
        '**WhatsApp: 6180 8022** or **Email: Admin@space8.com.hk**',
        '',
        'Please provide:',
        '• Order number (format: SPACE8-XXXXX-C)',
        '• Booking details (date, time slot)',
        '• Refund reason and supporting evidence (if applicable)',
        '',
        'The customer service team will review your application and respond with the outcome.',
      ],
    },
  ],
}
