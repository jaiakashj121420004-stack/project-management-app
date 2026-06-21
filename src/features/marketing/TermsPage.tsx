import { LegalPage, type LegalSection } from './LegalPage';

/*
  NON-LEGAL-ADVICE TEMPLATE. The Terms of Service copy below is generic
  boilerplate for a SaaS product and must be reviewed and adapted by a qualified
  lawyer before any commercial launch. It does not constitute legal advice.
*/

const SECTIONS: LegalSection[] = [
  {
    heading: 'Acceptance of terms',
    body: [
      'By creating an account or using Aurora (the "Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.',
      'We may update these terms from time to time. Continued use of the Service after changes take effect constitutes acceptance of the revised terms.',
    ],
  },
  {
    heading: 'Your account',
    body: [
      'You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account.',
      'You must provide accurate information when registering and keep it up to date. You must be old enough to form a binding contract in your jurisdiction to use the Service.',
    ],
  },
  {
    heading: 'Acceptable use',
    body: [
      'You agree not to misuse the Service, including by attempting to access data that is not yours, disrupting the Service, reverse-engineering it, or using it to store or distribute unlawful content.',
      'You retain ownership of the content you create. You grant us a limited licence to host and process that content solely to provide the Service to you and your collaborators.',
    ],
  },
  {
    heading: 'Subscriptions and billing',
    body: [
      'Aurora offers a free plan and a paid Pro plan. Paid subscriptions are billed in advance on a recurring basis through our payment processor and renew automatically until cancelled.',
      'You can change or cancel your plan at any time from your account. Except where required by law, fees already paid are non-refundable.',
    ],
  },
  {
    heading: 'Availability and changes',
    body: [
      'We strive to keep the Service available but do not guarantee uninterrupted access. We may modify, suspend, or discontinue features at any time.',
      'The Service is provided on an "as is" and "as available" basis without warranties of any kind, to the maximum extent permitted by law.',
    ],
  },
  {
    heading: 'Limitation of liability',
    body: [
      'To the fullest extent permitted by law, Aurora and its operators shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.',
    ],
  },
  {
    heading: 'Termination',
    body: [
      'You may stop using the Service and delete your account at any time. We may suspend or terminate your access if you breach these terms.',
    ],
  },
  {
    heading: 'Contact',
    body: ['Questions about these terms can be sent to the support contact listed in your account.'],
  },
];

/** Public Terms of Service page (starter template, not legal advice). */
export function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="June 2026"
      intro="These terms govern your access to and use of Aurora. Please read them carefully — they are a starter template and should be reviewed by a lawyer before commercial use."
      sections={SECTIONS}
    />
  );
}
