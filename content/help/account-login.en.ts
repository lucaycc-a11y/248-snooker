import type { HelpArticleContent } from './types'

export const accountLoginEn: HelpArticleContent = {
  title: 'Account Login Issues',
  intro: 'If you encounter problems logging into your Space8 member account, this guide will help you resolve them.',
  sections: [
    {
      title: 'Forgot Password',
      content: [
        '1. Click "Forgot Password" on the login page',
        '2. Enter your registered email address',
        '3. Check your email inbox (and spam folder)',
        '4. Click the password reset link',
        '5. Set a new password',
        {
          type: 'callout',
          variant: 'info',
          text: 'Password reset links are valid for 24 hours. If the link has expired, please request a new one.',
        },
      ],
    },
    {
      title: 'Cannot Find Password Reset Email',
      content: [
        'If you have not received the password reset email, please check:',
        '• Spam or promotional email folders',
        '• Whether the email address you entered is correct',
        '• Whether that email address is registered as a Space8 member',
        '',
        'If you still have not received it, wait 5 minutes and try again, or contact customer service.',
      ],
    },
    {
      title: 'Account Locked',
      content: [
        'To protect account security, your account will be temporarily locked after multiple consecutive incorrect password attempts.',
        '',
        'Solutions:',
        '• Wait 30 minutes before trying to log in again',
        '• Or use the "Forgot Password" function to reset your password immediately',
        '• If the problem persists, contact customer service',
      ],
    },
    {
      title: 'Other Reasons for Login Failure',
      content: [
        '**Email Address Not Verified**',
        'Newly registered members must verify their email address before logging in. Check the inbox of the email used during registration and click the verification link.',
        '',
        '**Account Suspended**',
        'If your account has been suspended for violating the Terms of Use, you will not be able to log in. Contact customer service for details.',
        '',
        '**Browser Issues**',
        'Try clearing your browser cache and cookies, or use a different browser to log in.',
      ],
    },
    {
      title: 'Need Assistance?',
      content: [
        'If the above methods still cannot resolve your login issue, please contact us:',
        '• WhatsApp: 6180 8022',
        '• Email: Admin@space8.com.hk',
        '',
        'Please provide your registered email address and the specific problem you are experiencing, and we will assist you as soon as possible.',
      ],
    },
  ],
}
