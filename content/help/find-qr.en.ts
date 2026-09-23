import type { HelpArticleContent } from './types'

export const findQrEn: HelpArticleContent = {
  title: 'How to Retrieve Your QR Code',
  intro: 'If you have lost your booking QR code, you can retrieve it through the following methods.',
  sections: [
    {
      title: 'View via Member Account',
      content: [
        '1. Log in to your Space8 member account',
        '2. Go to the "My Bookings" page',
        '3. Find the relevant booking',
        '4. Click "View QR Code"',
        '5. The QR code will display immediately on your screen',
        {
          type: 'callout',
          variant: 'info',
          text: 'You can take a screenshot of the QR code to save it, or display it directly on your phone.',
        },
      ],
    },
    {
      title: 'Resend to Email',
      content: [
        'If you cannot log in to your account, you can request the system to resend your QR code:',
        '',
        '1. On the login page, select "Need Help?"',
        '2. Choose "Resend QR Code"',
        '3. Enter your booking number and registered email',
        '4. The system will resend the QR code to your email',
        '',
        'Booking number format: SPACE8-XXXXX-C (found in your original booking confirmation email)',
      ],
    },
    {
      title: 'Contact Customer Service',
      content: [
        'If the above methods still cannot retrieve your QR code, please contact us immediately:',
        '',
        '**WhatsApp: 6180 8022**',
        'Please provide the following information:',
        '• Booking number (format: SPACE8-XXXXX-C)',
        '• Registered email address',
        '• Booking date and time slot',
        '',
        '**Email: Admin@space8.com.hk**',
        'We will assist you in resending your QR code as soon as we receive your message.',
      ],
    },
    {
      title: 'Preventive Measures',
      content: [
        'To avoid losing your QR code, we recommend:',
        '• Take a screenshot immediately after receiving the QR code',
        '• Mark your booking confirmation email as important',
        '• Check that your QR code is available in advance on your booking day',
        '• Keep your member account login credentials securely saved',
      ],
    },
  ],
}
