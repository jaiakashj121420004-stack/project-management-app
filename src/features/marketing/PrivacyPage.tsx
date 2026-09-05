import { LegalPage, type LegalSection } from './LegalPage';

/*
  Aurora is operated by Jai Akash, an individual sole proprietor trading as
  "Nvexis". Full long-form text lives in legal/Aurora-Privacy-Policy.docx —
  keep this in sync with that file if either changes.
*/

const SECTIONS: LegalSection[] = [
  {
    heading: 'Who is responsible for your data',
    body: [
      'Aurora is operated by Jai Akash, an individual sole proprietor trading as "Nvexis" ("we", "us", "our"), who is the data controller / data fiduciary for personal information processed through the Service. Contact and DPDP Grievance Officer: nvexis14@gmail.com. Postal: No. 91, Maha Vishnu Nagar, Arakkonam Road, SS Nagar Post, Tiruttani – 631211, Tamil Nadu, India.',
    ],
  },
  {
    heading: 'Information we collect',
    body: [
      'Account data (email, display name, auth data — we never store your password in plain text); Your Content (projects, boards, cards, notes, canvases, files, and collaboration data such as members and roles); billing status from our Merchant of Record, Dodo Payments (we never receive or store your full card number); and support messages you send us.',
      'We also collect limited technical/usage data automatically, and use strictly necessary cookies and local storage to keep you signed in and remember preferences such as your theme. We do not use cookies for advertising.',
    ],
  },
  {
    heading: 'How we share information',
    body: [
      'We do not sell your personal information. We share it only with the service providers that run the Service: Supabase (database, auth, storage, realtime), Cloudflare (hosting), Dodo Payments (billing), and Resend (transactional email) — each under its own agreement and privacy notice.',
      'We may also disclose information if required by law, to enforce our Terms, or in connection with a business transfer.',
    ],
  },
  {
    heading: 'How we use your information',
    body: [
      'To provide and sync the Service, authenticate and secure your account, enable the collaboration you set up, process subscriptions, send service/reminder emails, provide support, and detect and prevent abuse.',
    ],
  },
  {
    heading: 'International data transfers',
    body: [
      'We and our sub-processors may process and store information in countries other than yours, including where our hosting and providers operate, using appropriate safeguards for cross-border transfers where required.',
    ],
  },
  {
    heading: 'Data retention',
    body: [
      'We keep personal information for as long as your account is active. When you delete your account we delete or anonymise your personal data within a reasonable period, except where we must retain records for legal, tax, or security reasons. Backups and logs are retained briefly and then overwritten.',
    ],
  },
  {
    heading: 'How we protect your data',
    body: [
      'We use encryption in transit (HTTPS), row-level security so members can only access projects they belong to, private storage with signed URLs, rate limiting, and least-privilege secret handling. No system is perfectly secure, and we cannot guarantee absolute security — please use a strong password and keep your own backups of anything critical.',
    ],
  },
  {
    heading: 'Your rights',
    body: [
      'EEA/UK (GDPR): rights to access, rectify, erase, restrict, object, and port your data, and to lodge a complaint with your supervisory authority.',
      'California (CCPA/CPRA): rights to know, delete, and correct your information, and to opt out of sale/sharing — we do not sell or share your data as those terms are defined.',
      'India (DPDP Act 2023): rights to access a summary of your data, correction, erasure, and grievance redressal via our Grievance Officer at nvexis14@gmail.com. If a personal data breach occurs, we will notify the Data Protection Board of India and affected users as required by law.',
      'To exercise any of these rights, contact nvexis14@gmail.com.',
    ],
  },
  {
    heading: "Children's privacy",
    body: [
      'The Service is not directed to, and we do not knowingly collect information from, children under 18 (or the applicable minimum age where you live).',
    ],
  },
  {
    heading: 'Changes to this policy',
    body: [
      'We may update this policy. If a change is material, we will give reasonable notice and update the "Last updated" date above.',
    ],
  },
  {
    heading: 'Contact us',
    body: ['Privacy questions, requests, and DPDP grievances: nvexis14@gmail.com.'],
  },
];

/** Public Privacy Policy page. Full long-form text: legal/Aurora-Privacy-Policy.docx. */
export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="5 September 2026"
      intro="This policy explains what information Aurora collects, how it is used and shared, how long it is kept, and the choices and rights you have."
      sections={SECTIONS}
    />
  );
}
