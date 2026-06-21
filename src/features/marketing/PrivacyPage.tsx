import { LegalPage, type LegalSection } from './LegalPage';

/*
  NON-LEGAL-ADVICE TEMPLATE. The Privacy Policy copy below is generic
  boilerplate for a SaaS product and must be reviewed and adapted by a qualified
  lawyer (and checked against laws such as GDPR/CCPA) before any commercial
  launch. It does not constitute legal advice.
*/

const SECTIONS: LegalSection[] = [
  {
    heading: 'Information we collect',
    body: [
      'We collect the information you provide when you create an account, such as your email address and display name, and the content you create in the app (projects, boards, cards, notes, and similar).',
      'We also collect limited technical information automatically, such as basic device and usage data, to operate and improve the Service.',
    ],
  },
  {
    heading: 'How we use your information',
    body: [
      'We use your information to provide and maintain the Service, sync your data across devices, send you reminders and important account notices, and improve the product.',
      'We do not sell your personal information.',
    ],
  },
  {
    heading: 'Sharing and collaboration',
    body: [
      'Content you place in a shared project is visible to the members you invite to that project, according to their role. You control who you invite.',
      'We share data with service providers who help us run the Service — for example, our hosting, database, authentication, and payment providers — only as needed to operate it.',
    ],
  },
  {
    heading: 'Data security',
    body: [
      'We use industry-standard measures to protect your data, including row-level security so members can only access projects they belong to. No method of transmission or storage is completely secure, however, and we cannot guarantee absolute security.',
    ],
  },
  {
    heading: 'Data retention',
    body: [
      'We keep your information for as long as your account is active. When you delete your account, we delete or anonymize your personal data, except where we are required to retain it by law.',
    ],
  },
  {
    heading: 'Your rights',
    body: [
      'Depending on where you live, you may have rights to access, correct, export, or delete your personal information. You can exercise many of these directly in the app, or by contacting us.',
    ],
  },
  {
    heading: 'Cookies and local storage',
    body: [
      'We use essential cookies and similar technologies to keep you signed in and remember preferences such as your theme. We do not use them for third-party advertising.',
    ],
  },
  {
    heading: 'Contact',
    body: ['For privacy questions or requests, use the support contact listed in your account.'],
  },
];

/** Public Privacy Policy page (starter template, not legal advice). */
export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="June 2026"
      intro="This policy explains what information Aurora collects, how we use it, and the choices you have. It is a starter template and should be reviewed by a lawyer before commercial use."
      sections={SECTIONS}
    />
  );
}
