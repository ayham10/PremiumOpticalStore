import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privacy Policy — OYON Optics",
  description:
    "Privacy Policy for OYON Optics. Learn how we collect, use, and protect personal information submitted through our website and appointment booking services.",
};

const LAST_UPDATED = "August 29, 2026";

export default function PrivacyPolicyPage() {
  return (
    <div className="privacy-page about-page">
      <header className="privacy-hero wrap">
        <p className="about-eyebrow">OYON Optics</p>
        <h1 className="about-hero-title">Privacy Policy</h1>
        <p className="privacy-updated">Last updated: {LAST_UPDATED}</p>
        <p className="about-hero-lead">
          This Privacy Policy describes how OYON Optics (&ldquo;OYON&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;) handles personal information
          collected through our website and appointment booking services.
        </p>
      </header>

      <div className="privacy-content wrap">
        <section className="privacy-section">
          <h2 className="privacy-heading">Information we may collect</h2>
          <p className="privacy-text">
            When you use our website or book an appointment, we may collect
            information that you voluntarily provide, including:
          </p>
          <ul className="privacy-list">
            <li>Your name</li>
            <li>Your phone number</li>
            <li>Appointment date and time</li>
            <li>The service or reason selected for your booking</li>
            <li>
              Other information you choose to submit through our website, booking
              forms, or direct communications with us
            </li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2 className="privacy-heading">How we use information</h2>
          <p className="privacy-text">
            We use the information described above to operate our business and
            provide our services, including to:
          </p>
          <ul className="privacy-list">
            <li>Manage and confirm appointments</li>
            <li>Communicate with customers about bookings and services</li>
            <li>Send booking confirmations and appointment reminders</li>
            <li>Respond to inquiries and provide customer support</li>
            <li>Maintain records related to appointments and customer service</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2 className="privacy-heading">WhatsApp messaging</h2>
          <p className="privacy-text">
            We may use the WhatsApp Business Platform, provided by Meta, to
            send booking-related WhatsApp messages such as appointment
            confirmations and reminders. When we send these messages, your phone
            number and message content are processed according to this Privacy
            Policy and Meta&apos;s own terms and policies applicable to the
            WhatsApp Business Platform.
          </p>
        </section>

        <section className="privacy-section">
          <h2 className="privacy-heading">How we share information</h2>
          <p className="privacy-text">
            We do not sell customer personal information. We may share information
            only as reasonably needed to provide our services, such as with
            service providers that help us operate our website, store data, or
            deliver communications, and when required by applicable law.
          </p>
        </section>

        <section className="privacy-section">
          <h2 className="privacy-heading">Data retention</h2>
          <p className="privacy-text">
            We retain personal information for as long as reasonably necessary
            to manage appointments, provide customer service, meet legal or
            accounting requirements, and resolve disputes. Retention periods may
            vary depending on the type of information and how it is used.
          </p>
        </section>

        <section className="privacy-section">
          <h2 className="privacy-heading">Security</h2>
          <p className="privacy-text">
            We take reasonable administrative, technical, and organizational
            measures designed to protect personal information against unauthorized
            access, loss, misuse, or alteration. No method of transmission or
            storage is completely secure, and we cannot guarantee absolute
            security.
          </p>
        </section>

        <section className="privacy-section">
          <h2 className="privacy-heading">Your choices and rights</h2>
          <p className="privacy-text">
            Depending on your location and applicable law, you may have rights
            regarding your personal information, such as the right to request
            access, correction, or deletion of certain information, or to object
            to or restrict certain processing. To make a request, please contact
            us using the details below. We will respond within a reasonable
            time, subject to applicable legal requirements.
          </p>
        </section>

        <section className="privacy-section">
          <h2 className="privacy-heading">Contact us</h2>
          <p className="privacy-text">
            If you have questions about this Privacy Policy or how we handle
            personal information, please contact:
          </p>
          <ul className="privacy-contact-list">
            <li>
              <strong>Business:</strong> OYON Optics
            </li>
            <li>
              <strong>Email:</strong>{" "}
              <a href="mailto:info@oyonoptics.com">info@oyonoptics.com</a>
            </li>
            <li>
              <strong>Website:</strong>{" "}
              <a href="https://www.oyonoptics.com" rel="noopener noreferrer">
                www.oyonoptics.com
              </a>
            </li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2 className="privacy-heading">Changes to this policy</h2>
          <p className="privacy-text">
            We may update this Privacy Policy from time to time. When we do, we
            will revise the &ldquo;Last updated&rdquo; date at the top of this
            page. We encourage you to review this page periodically for the
            latest information.
          </p>
        </section>

        <p className="privacy-back">
          <Link href="/" className="privacy-back-link">
            Return to homepage
          </Link>
        </p>
      </div>
    </div>
  );
}
