import type { HelpArticleContent } from './types'

export const bookingEn: HelpArticleContent = {
  title: 'How to Book a Time Slot',
  intro: 'Space8 uses a members-only online booking system for convenient reservation of your preferred time slots.',
  sections: [
    {
      title: 'Booking Process',
      content: [
        '1. Log in to your Space8 member account',
        '2. Select "Book Now"',
        '3. Choose your date and time slot (the system will display available slots)',
        '4. Confirm booking details and fees',
        '5. Complete payment',
        '6. The system will send a QR code to your email',
        {
          type: 'callout',
          variant: 'info',
          text: 'Bookings are only confirmed after payment is completed. Unpaid bookings will not reserve time slots.',
        },
      ],
    },
    {
      title: 'Time Slot Usage and Departure',
      content: [
        'Please depart the venue promptly at your booking end time.',
        'If you remain on the premises 15 minutes after your booking end time, the Company may charge you an overtime fee. Overtime fees are calculated at the booking rate per hour (any partial hour counts as a full hour).',
        {
          type: 'callout',
          variant: 'warning',
          text: 'Please be mindful of departure times to avoid additional charges.',
        },
      ],
    },
    {
      title: 'Venue Restoration Responsibilities',
      content: [
        'After use, members must restore the venue to its original condition, including:',
        '• Removing all personal belongings and trash',
        '• Returning all equipment to its original location',
        '• Cleaning used areas',
        '• Turning off all lights and equipment',
        '• Locking all doors and windows',
        '',
        'If the venue is not restored as required, the Company reserves the right to charge a cleaning fee.',
      ],
    },
    {
      title: 'Booking Restrictions',
      content: [
        '• Each member may book a maximum of 2 time slots per day',
        '• Minimum booking duration is 1 hour',
        '• Bookings must be made at least 1 hour in advance',
        '• Members may not transfer bookings to others',
      ],
    },
  ],
}
