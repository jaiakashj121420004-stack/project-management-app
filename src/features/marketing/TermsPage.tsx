import { LegalPage, type LegalSection } from './LegalPage';

/*
  Aurora is operated by Jai Akash, an individual sole proprietor trading as
  "Nvexis". Full long-form text lives in legal/Aurora-Terms-of-Service.docx —
  keep this in sync with that file if either changes.
*/

const OPERATOR_CONTACT =
  'Jai Akash, No. 91, Maha Vishnu Nagar, Arakkonam Road, SS Nagar Post, Tiruttani – 631211, Tamil Nadu, India. General and legal notices: nvexis14@gmail.com.';

const SECTIONS: LegalSection[] = [
  {
    heading: 'Who we are and these Terms',
    body: [
      'Aurora (the "Service") is a project-management application — Kanban boards, to-do lists, calendars, notes, a canvas, and collaboration — delivered as an installable web app (PWA). The Service is operated by an individual sole proprietor trading as "Nvexis" ("we", "us", "our"). "Aurora" is the product; "Nvexis" is the operator.',
      'By checking "I agree to the Terms of Service and Privacy Policy" at signup, or by otherwise creating an account or using the Service, you accept these Terms and our Privacy Policy in full. If you do not agree, do not use the Service.',
      `Operator contact: ${OPERATOR_CONTACT}`,
    ],
  },
  {
    heading: 'Eligibility and your account',
    body: [
      'You must be at least 18 years old, or the age of majority in your jurisdiction if higher, to use the Service. The Service is not directed to children.',
      'You are responsible for the accuracy of the information you provide, for keeping your credentials confidential, and for all activity under your account, including activity by anyone you share your credentials with.',
    ],
  },
  {
    heading: 'Plans, billing and our Merchant of Record',
    body: [
      'Aurora offers a free plan and paid Pro/Team plans. Paid subscriptions are sold and processed through our authorised reseller and Merchant of Record, Dodo Payments — Dodo, not us directly, is the merchant of record: it processes payment, handles applicable taxes, and issues receipts.',
      'Subscriptions renew automatically at the then-current price until cancelled. You may cancel at any time; access continues until the end of the paid period. Except where required by law, fees already paid are non-refundable.',
    ],
  },
  {
    heading: 'Your content and licence to us',
    body: [
      'You retain all ownership of the content you create — projects, boards, notes, canvases, files, and similar ("Your Content"). We do not claim ownership of it.',
      'You grant us a limited licence to host, store, and process Your Content solely to operate the Service for you and the collaborators you authorise. You are solely responsible for Your Content and for having the rights to submit it.',
    ],
  },
  {
    heading: 'Acceptable use',
    body: [
      'You agree not to access data or accounts you are not authorised to use, probe or bypass security measures, reverse-engineer the Service, disrupt or overload it, upload malware or unlawful content, or resell or commercially exploit the Service without permission. A breach of this section may result in immediate suspension or termination without refund.',
    ],
  },
  {
    heading: 'Collaboration and shared workspaces',
    body: [
      'You can invite others to projects, notes, and canvases with assigned roles. Content in a shared workspace is visible to the members you invite. You are solely responsible for whom you invite, and we are not responsible for actions taken by collaborators you have authorised.',
    ],
  },
  {
    heading: 'Availability and changes',
    body: [
      'We aim to keep the Service available but do not guarantee uninterrupted, secure, or error-free operation. We may modify, suspend, or discontinue features at any time, and may release beta features that are provided "as is" and may change or be withdrawn.',
    ],
  },
  {
    heading: 'Disclaimer of warranties',
    body: [
      'To the maximum extent permitted by law, the Service is provided "as is" and "as available," without warranties of any kind, express or implied. We do not warrant that the Service will be uninterrupted, secure, or error-free, or that data will not be lost, corrupted, or become unavailable for any reason.',
      'You are solely responsible for maintaining your own independent backups of any content that matters to you. We are not liable for any loss of Your Content, however caused, to the maximum extent permitted by law.',
    ],
  },
  {
    heading: 'Limitation of liability',
    body: [
      'Nothing here excludes liability that cannot be excluded under applicable law (for example fraud, or death/personal injury from negligence). Subject to that, to the maximum extent permitted by law we will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for loss of profits, revenue, data, or goodwill, arising out of the Service or these Terms.',
      'Our total aggregate liability for all claims relating to the Service will not exceed the greater of (a) the amount you paid us in the 12 months before the claim, or (b) ₹100 (Indian Rupees One Hundred).',
    ],
  },
  {
    heading: 'Indemnification',
    body: [
      'You agree to indemnify us against claims, damages, and reasonable legal expenses arising from Your Content, your use of the Service, or your breach of these Terms or applicable law, except to the extent caused by our own fraud or wilful misconduct.',
    ],
  },
  {
    heading: 'Termination',
    body: [
      'You may stop using the Service and delete your account at any time. We may suspend or terminate your access if you breach these Terms, to protect the Service or other users, or as required by law.',
    ],
  },
  {
    heading: 'Governing law and disputes',
    body: [
      'These Terms are governed by the laws of India, and the competent courts at Thiruvallur, Tamil Nadu will have exclusive jurisdiction, subject to any mandatory consumer-protection rights you have where you live.',
    ],
  },
  {
    heading: 'Contact',
    body: ['Questions about these Terms, support, and billing: nvexis14@gmail.com.'],
  },
];

/** Public Terms of Service page. Full long-form text: legal/Aurora-Terms-of-Service.docx. */
export function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="5 September 2026"
      intro="These Terms govern your access to and use of Aurora, a project-management application operated by Jai Akash, an individual sole proprietor trading as “Nvexis”. Please read them carefully."
      sections={SECTIONS}
    />
  );
}
