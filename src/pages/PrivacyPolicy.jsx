import React from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import {
  CossCardFrame,
  CossIconTile,
  CossPage,
  CossPageHeader,
  CossSection,
} from '../components/public/CossLayout';
import { useSite } from '../context/SiteContext';
import { getSupportEmail } from '../constants/compliance';

const EFFECTIVE_DATE = 'May 26, 2026';

const privacySections = [
  {
    title: '1. Information we collect',
    body: [
      'We may collect account information such as username, email address, password credentials, support messages, and settings you provide.',
      'We collect service data such as API keys, subscription status, usage records, request metadata, logs, device information, browser information, IP address, and security events.',
      'Payment and subscription data may be processed by payment providers. We receive information needed to confirm purchases, renewals, cancellations, and account entitlement.',
    ],
  },
  {
    title: '2. AI request data',
    body: [
      'When you use API or playground features, prompts, inputs, files, metadata, and generated outputs may be processed to route requests, return responses, prevent abuse, debug issues, and measure usage.',
      'Requests may be sent to model providers, infrastructure providers, or downstream services needed to complete the request you initiate.',
    ],
  },
  {
    title: '3. How we use information',
    body: [
      'We use information to provide the service, authenticate users, issue API keys, process subscriptions, track quotas, secure the platform, respond to support requests, improve reliability, and comply with legal obligations.',
      'We may use aggregated or de-identified information to understand product performance and improve the service.',
    ],
  },
  {
    title: '4. Cookies and local storage',
    body: [
      'We use cookies, local storage, and similar technologies to keep users signed in, remember preferences, cache site configuration, prevent fraud, and improve the user experience.',
      'Browser settings may allow you to block or clear these technologies, but some service features may stop working correctly.',
    ],
  },
  {
    title: '5. Sharing information',
    body: [
      'We share information with service providers that help operate the platform, including hosting, analytics, security, payment, customer support, and AI model infrastructure providers.',
      'We may disclose information if required by law, to protect rights and safety, to investigate abuse, or as part of a business transfer such as a merger, acquisition, or asset sale.',
    ],
  },
  {
    title: '6. Retention and security',
    body: [
      'We retain information for as long as needed to provide the service, comply with legal obligations, resolve disputes, enforce agreements, and maintain security.',
      'We use reasonable technical and organizational safeguards, but no internet service can guarantee absolute security.',
    ],
  },
  {
    title: '7. Your choices',
    body: [
      'You may update account information, rotate or delete API keys, cancel subscriptions when available, and contact support to request access, correction, export, or deletion of personal information.',
      'Some records may be retained where required for billing, security, legal compliance, fraud prevention, or dispute resolution.',
    ],
  },
  {
    title: '8. Children',
    body: [
      'The service is not directed to children under 13, and we do not knowingly collect personal information from children under 13.',
    ],
  },
  {
    title: '9. Changes to this policy',
    body: [
      'We may update this Privacy Policy from time to time. The updated version will be posted on this page with a new effective date when appropriate.',
    ],
  },
];

export default function PrivacyPolicy() {
  const { site } = useSite();
  const siteName = site?.name || 'SubRouter';
  const supportEmail = getSupportEmail(site);

  return (
    <CossPage>
      <CossPageHeader
        eyebrow="Legal"
        icon={ShieldCheck}
        title="Privacy Policy"
        description={`This Privacy Policy explains how ${siteName} collects, uses, shares, and protects information when you use the service.`}
        secondary={`Effective date: ${EFFECTIVE_DATE}`}
        actions={(
          <CossCardFrame className="p-5">
            <div className="flex items-center gap-2">
              <CossIconTile icon={Mail} />
              <h2 className="font-semibold text-slate-950">Privacy contact</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Privacy questions and requests can be sent to{' '}
              <a href={`mailto:${supportEmail}`} className="font-semibold text-slate-950 hover:text-slate-700">
                {supportEmail}
              </a>.
            </p>
          </CossCardFrame>
        )}
      />

      <CossSection className="max-w-4xl space-y-4">
        {privacySections.map((section) => (
          <CossCardFrame key={section.title} className="p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-950">{section.title}</h2>
            <div className="mt-3 space-y-3">
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-7 text-slate-600">{paragraph}</p>
              ))}
            </div>
          </CossCardFrame>
        ))}
      </CossSection>
    </CossPage>
  );
}
