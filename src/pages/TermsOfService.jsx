import React from 'react';
import { Mail, Scale } from 'lucide-react';
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

const termsSections = [
  {
    title: '1. Service',
    body: [
      'The service provides access to AI models, API gateway features, account tools, usage history, documentation, subscriptions, and related platform features.',
      'You are responsible for deciding whether the service is appropriate for your use case and for reviewing any AI-generated content before relying on it.',
    ],
  },
  {
    title: '2. Accounts and API keys',
    body: [
      'You must provide accurate account information and keep your login credentials and API keys secure.',
      'You are responsible for all activity under your account, including requests made with API keys issued to your account.',
    ],
  },
  {
    title: '3. Acceptable use',
    body: [
      'You may not use the service to violate laws, infringe others rights, distribute malware, attack or disrupt systems, send spam, abuse rate limits, or attempt to bypass access controls.',
      'You may not resell, scrape, or automate access in a way that harms platform stability or other users unless we have agreed to those terms in writing.',
    ],
  },
  {
    title: '4. Billing and subscriptions',
    body: [
      'Paid plans, subscriptions, credits, limits, renewal periods, and taxes are shown at checkout or in the account interface.',
      'Fees are non-refundable except where required by law or expressly stated in a separate written agreement.',
    ],
  },
  {
    title: '5. AI outputs',
    body: [
      'AI outputs can be inaccurate, incomplete, offensive, or unsuitable for a particular purpose.',
      'You are responsible for evaluating outputs and for using the service in compliance with laws, professional obligations, and third-party rights.',
    ],
  },
  {
    title: '6. Availability and changes',
    body: [
      'We may update, suspend, limit, or discontinue features, models, routes, pricing, or availability to maintain security, reliability, legal compliance, or business operations.',
      'The service is provided without warranties of uninterrupted availability, error-free operation, or fitness for a particular purpose.',
    ],
  },
  {
    title: '7. Suspension and termination',
    body: [
      'We may suspend or terminate access if we believe an account violates these terms, creates security or legal risk, or causes harm to the service or other users.',
      'You may stop using the service at any time. Some obligations, including payment obligations and restrictions on misuse, survive termination.',
    ],
  },
  {
    title: '8. Limitation of liability',
    body: [
      'To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost data, or business interruption.',
      'Our total liability for claims related to the service is limited to the amount you paid for the service in the three months before the event giving rise to the claim.',
    ],
  },
  {
    title: '9. Changes to these terms',
    body: [
      'We may update these terms from time to time. Continued use of the service after changes become effective means you accept the updated terms.',
    ],
  },
];

export default function TermsOfService() {
  const { site } = useSite();
  const siteName = site?.name || 'SubRouter';
  const supportEmail = getSupportEmail(site);

  return (
    <CossPage>
      <CossPageHeader
        eyebrow="Legal"
        icon={Scale}
        title="Terms of Service"
        description={`These Terms of Service govern access to and use of ${siteName}.`}
        secondary={`Effective date: ${EFFECTIVE_DATE}`}
        actions={(
          <CossCardFrame className="p-5">
            <div className="flex items-center gap-2">
              <CossIconTile icon={Mail} />
              <h2 className="font-semibold text-slate-950">Support contact</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Questions about these terms can be sent to{' '}
              <a href={`mailto:${supportEmail}`} className="font-semibold text-slate-950 hover:text-slate-700">
                {supportEmail}
              </a>.
            </p>
          </CossCardFrame>
        )}
      />

      <CossSection className="max-w-4xl space-y-4">
        {termsSections.map((section) => (
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
