import type { HelpArticleContent } from './types'

export const tierPointsEn: HelpArticleContent = {
  title: 'Membership Tiers and Points System',
  intro: 'The Space8 membership tier system lets you earn points through bookings and unlock higher tiers with increased point multipliers.',
  sections: [
    {
      title: 'Membership Tier Overview',
      content: [
        'Space8 has three membership tiers, each with different point multipliers:',
        '',
        '**Amateur (Starting Tier)**',
        '• Requirement: 0 points (automatically granted to all new members)',
        '• Point Multiplier: 1x',
        '• This is the starting tier for all new members',
        '',
        '**Century**',
        '• Requirement: 800+ points',
        '• Point Multiplier: 1.5x (earn 50% more points per booking)',
        '',
        '**Maximum (Top Tier)**',
        '• Requirement: 6,000+ points',
        '• Point Multiplier: 2x (earn double points per booking)',
      ],
    },
    {
      title: 'How to Earn Points',
      content: [
        'Members earn points through:',
        '',
        '**Completing Bookings**',
        'After each completed booking, the system calculates points based on the booking amount and your current tier multiplier.',
        '',
        'Calculation Formula:',
        'Points = Booking Amount × Tier Multiplier',
        '',
        'Examples:',
        '• Amateur tier member books HK$100 slot → earns 100 points',
        '• Century tier member books HK$100 slot → earns 150 points',
        '• Maximum tier member books HK$100 slot → earns 200 points',
        {
          type: 'callout',
          variant: 'info',
          text: 'Your point multiplier takes effect immediately after reaching a new tier and applies to all subsequent bookings.',
        },
      ],
    },
    {
      title: 'Tier Upgrades',
      content: [
        'When your total points reach the requirement for the next tier, the system automatically upgrades your membership tier.',
        '',
        'Upgrade Path:',
        '• Amateur (0 pts) → Century (800 pts) → Maximum (6,000 pts)',
        '',
        'After Upgrade:',
        '• Your new point multiplier takes effect immediately',
        '• You will receive an upgrade notification email',
        '• You can view your new tier badge in your member account',
      ],
    },
    {
      title: 'View Your Points and Tier',
      content: [
        'Log in to your Space8 member account anytime to view:',
        '• Current tier',
        '• Total points',
        '• Points needed to reach the next tier',
        '• Points history',
      ],
    },
    {
      title: 'Points Validity',
      content: [
        'Currently, Space8 points do not expire and are permanently retained in your account.',
        {
          type: 'callout',
          variant: 'info',
          text: 'The Company reserves the right to adjust the points policy in the future. Any changes will be communicated to members in advance.',
        },
      ],
    },
  ],
}
