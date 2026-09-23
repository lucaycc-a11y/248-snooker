import type { HelpArticleContent } from './types'

export const entryQrEn: HelpArticleContent = {
  title: 'How to Use Your Member QR Code to Enter the Venue',
  intro: 'After completing your booking payment, you will receive a unique QR code to access the Space8 venue.',
  sections: [
    {
      title: 'Where to Find Your QR Code',
      content: [
        'After successful payment, the system will automatically send the QR code to your registered email address.',
        'You can also log in to your member account anytime and view all valid QR codes under "My Bookings".',
      ],
    },
    {
      title: 'How to Use Your QR Code for Entry',
      content: [
        '1. Upon arriving at the Space8 venue, locate the QR code scanner at the entrance',
        '2. Open your QR code (you can display it on your phone screen or print a paper copy)',
        '3. Align the QR code with the scanner',
        '4. After hearing a "beep," the door lock will automatically open',
        '5. Enter the venue and enjoy your booked time slot',
      ],
    },
    {
      title: 'Early Arrival and Late Departure Grace Periods',
      content: [
        'For member convenience, Space8 provides the following grace periods:',
        '• Early Entry: You may enter up to 10 minutes before your booking start time',
        '• Late Exit: You may leave up to 10 minutes after your booking end time',
        {
          type: 'callout',
          variant: 'info',
          text: 'Please note: These grace periods are for venue access only and do not extend your actual booking duration.',
        },
      ],
    },
    {
      title: 'Frequently Asked Questions',
      content: [
        '**Q: What should I do if my QR code cannot be scanned?**',
        'A: Please ensure your screen brightness is sufficient and align the QR code fully with the scanner. If it still does not work, contact customer service immediately via WhatsApp at 6180 8022.',
        '',
        '**Q: Can I share my QR code with a friend?**',
        'A: No. Each QR code corresponds to one booking and is for use by the booking member only.',
        '',
        '**Q: How long is the QR code valid?**',
        'A: The QR code is valid only during your booking time slot (including the 10-minute early entry grace period).',
      ],
    },
  ],
}
