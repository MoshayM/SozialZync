import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy · Sozialzynk',
  description: 'How Sozialzynk collects, uses, and protects your data.',
};

const SECTIONS = [
  {
    id: 'information-we-collect',
    title: '1. Information We Collect',
    content: `We collect the following categories of information when you use Sozialzynk:

Account Data: When you register, we collect your name, email address, and password (stored as a bcrypt hash). If you sign in via Google OAuth, we receive your name, email, and profile picture from that provider. If you register a passkey (WebAuthn), we store the public credential ID and attestation data — never the private key, which never leaves your device.

Usage Data: We log interactions with the platform — pages visited, features used, AI Copilot prompts submitted, and content generated. This data is used to improve our service and is never sold.

Voice Data: If you use the AI Copilot voice interface, audio is captured temporarily in your browser, converted to text via speech recognition (on-device where supported), and only the transcript is transmitted to our servers. Raw audio is not stored on our servers.

Content You Create: Scripts, captions, thumbnails, AI-generated characters, avatar images, voice narrations, audio tracks, and other assets you produce through Sozialzynk are stored in your account and are yours to export or delete at any time. Provenance metadata (model, timestamp, prompt hash) is stored with every AI-generated asset.

Platform Connection Data: When you connect your YouTube account or other social accounts, we store OAuth access tokens and refresh tokens to publish content and retrieve analytics on your behalf. We request only the minimum OAuth scopes necessary for the features you use. You can revoke access at any time from your settings.

Payment Data: If you subscribe to a paid plan, payment details are processed and stored by Stripe. We only store your subscription status, plan tier, and Stripe customer ID — never your raw card details.`,
  },
  {
    id: 'how-we-use',
    title: '2. How We Use Your Information',
    content: `We use the information we collect to:

• Operate and deliver the Sozialzynk service, including the full AI content pipeline: research, scripting, fact-checking, compliance checking, voice generation, image generation, and YouTube publishing.
• Improve our AI pipeline using anonymized, aggregated usage patterns. We do not use your identifiable content to train AI models without your explicit opt-in consent.
• Send transactional emails such as password resets, billing receipts, and service notifications. We do not send marketing emails without your consent.
• Run compliance checks on all content before it is made available for publishing, to ensure it meets YouTube's policies and copyright requirements.
• Detect and prevent fraud, abuse, and violations of our Terms of Service.
• Respond to your support requests and communicate about your account.`,
  },
  {
    id: 'data-sharing',
    title: '3. Data Sharing',
    content: `We do not sell, rent, or trade your personal data to third parties. We share data only in these limited circumstances:

AI Providers: Prompts and content requests are sent to AI providers (including Claude/Anthropic, Google Gemini, and OpenAI) in anonymized or pseudonymized form where possible, for generation and analysis. These providers are bound by data processing agreements that prohibit using your data for their own model training.

Voice & Audio Providers: If you use text-to-speech or voice synthesis features, text content is sent to the configured audio provider (e.g., ElevenLabs, Google TTS). No raw audio recorded from your microphone is forwarded to any third party.

Image & Video Providers: Image and video generation requests are sent to configured providers (e.g., Stable Diffusion, Kling, Veo). Only the prompt and generation parameters are transmitted — not your account identity.

Payment Processing: Stripe processes all payments. Your payment data is subject to Stripe's Privacy Policy.

Hosting & Infrastructure: We use cloud infrastructure providers (including Vercel and managed cloud services) that host our application. These providers have access only to data necessary to run our systems and are bound by strict data processing agreements.

Legal Requirements: We may disclose data if required by law, court order, or to protect the rights, safety, and property of Sozialzynk, our users, or the public.

Business Transfers: In the event of a merger, acquisition, or sale of assets, user data may be transferred as part of that transaction. We will notify you via email or prominent in-app notice before your data becomes subject to a different privacy policy.`,
  },
  {
    id: 'data-retention',
    title: '4. Data Retention',
    content: `Account data is retained for as long as your account is active. If you delete your account, we permanently delete your personal data within 90 days, except where we are required to retain it for legal or regulatory obligations (e.g., billing records are kept for 7 years for tax compliance).

AI-generated content (scripts, characters, images, voice tracks) associated with your account is deleted within 30 days of account deletion. WebAuthn/passkey credentials are deleted immediately upon account deletion. Anonymized, aggregated analytics derived from your usage may be retained indefinitely as they cannot be linked back to you.

You may request deletion of specific data at any time by contacting privacy@sozialzync.com.`,
  },
  {
    id: 'your-rights',
    title: '5. Your Rights',
    content: `Depending on your location, you may have the following rights regarding your personal data:

Access: Request a copy of the personal data we hold about you.
Correction: Request that we correct inaccurate or incomplete data.
Deletion: Request that we delete your personal data ("right to be forgotten").
Portability: Request an export of your data in a machine-readable format.
Opt-out of AI Training: Opt out of having your content used to improve our AI models via Settings → Privacy.
Restriction: Request that we restrict processing of your data in certain circumstances.
Objection: Object to our processing of your data where we rely on legitimate interests.

To exercise any of these rights, email privacy@sozialzync.com. We will respond within 30 days. Users in the European Economic Area (EEA), United Kingdom, and California have additional rights under GDPR, UK GDPR, and CCPA respectively.`,
  },
  {
    id: 'cookies',
    title: '6. Cookies & Tracking',
    content: `Sozialzynk uses only functional cookies necessary to operate the service:

• Session cookies to keep you logged in during a browsing session.
• Preference cookies to remember settings such as your selected theme or language.

We do not use advertising cookies, third-party tracking pixels, or behavioral analytics tools. We do not serve ads and have no advertising partners.

You can disable cookies in your browser settings, but this may prevent certain features from working correctly.`,
  },
  {
    id: 'childrens-privacy',
    title: "7. Children's Privacy",
    content: `Sozialzynk is intended for users aged 13 and older. We do not knowingly collect personal data from children under 13. If you believe a child under 13 has created an account, please contact us at privacy@sozialzync.com and we will promptly delete the account and associated data.

Users between 13 and 18 should ensure they have parental or guardian consent before using the platform.`,
  },
  {
    id: 'security',
    title: '8. Security',
    content: `We implement industry-standard security measures to protect your data:

• All data is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption.
• Passwords are hashed using bcrypt with an appropriate cost factor; we never store plaintext passwords.
• Passkey/WebAuthn credentials follow the W3C WebAuthn specification: only the public key and credential ID are stored on our servers. The private key never leaves your device.
• OAuth tokens are stored encrypted and are never exposed in API responses.
• AI-generated asset provenance metadata is immutable and tied to your account for auditability.
• Access to production data is restricted to authorized personnel and logged for audit purposes.
• We conduct regular security audits and vulnerability assessments.

While we take extensive precautions, no system is completely secure. If you discover a security vulnerability, please report it responsibly to security@sozialzync.com.`,
  },
  {
    id: 'contact',
    title: '9. Contact Us',
    content: `If you have questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact our Privacy team:

Email: privacy@sozialzync.com
Response time: We aim to respond within 5 business days.

For data subject requests under GDPR or CCPA, please include "Data Subject Request" in the subject line and specify the right you are exercising.`,
  },
  {
    id: 'changes',
    title: '10. Changes to This Policy',
    content: `We may update this Privacy Policy from time to time. When we make material changes, we will:

• Update the "Effective Date" at the top of this page.
• Send an email notification to registered users at least 14 days before the change takes effect.
• Display a prominent in-app notice for significant changes.

Your continued use of Sozialzynk after the effective date of a revised policy constitutes your acceptance of the changes. If you do not agree to the updated policy, you may delete your account before the effective date.`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #4f2ec4 0%, #6D4AE0 55%, #7c5ae8 100%)' }} className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium mb-8 transition-colors"
          >
            ← Back to Sozialzynk
          </Link>
          <div className="inline-flex items-center gap-2 bg-white/15 text-white/85 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            Legal
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-3">
            Privacy Policy
          </h1>
          <p className="text-white/65 text-base">
            Effective date: <strong className="text-white/85">August 7, 2026</strong>
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Intro */}
        <div className="bg-white rounded-2xl p-6 mb-8 border border-gray-100 shadow-sm">
          <p className="text-gray-600 leading-relaxed">
            Sozialzynk (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is committed to protecting your privacy.
            This Privacy Policy explains how we collect, use, share, and protect your personal information
            when you use our AI-powered YouTube Content Operating System. Please read it carefully.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
            >
              <h2 className="text-lg font-bold text-gray-900 pb-3 mb-4 border-b border-gray-100">
                {section.title}
              </h2>
              <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-10 text-center text-sm text-gray-400 space-y-2">
          <p>Last updated: August 7, 2026</p>
          <p>
            Also read our{' '}
            <Link href="/terms" className="text-[#6D4AE0] hover:underline font-medium">
              Terms of Service
            </Link>
          </p>
          <p>
            <Link href="/" className="text-[#6D4AE0] hover:underline">
              ← Return to Sozialzynk
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
