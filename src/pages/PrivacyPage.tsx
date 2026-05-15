import { LegalLayout } from './LegalLayout'

/**
 * Privacy Policy.
 *
 * Same placeholder caveats as TermsPage — see that file for the list of
 * fields to revise when the legal entity is finalized.
 *
 * Note for §1: this policy lists Sentry and JWT localStorage tokens as
 * concrete data points so it accurately matches what the app actually
 * does (verified during the cookie-consent audit). When you add Google
 * Analytics, Meta Pixel, Hotjar, etc., update §1 and §8.
 */
export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy — FoundersLib"
      description="How FoundersLib collects, uses, stores, and protects your information."
      path="/privacy"
      lastUpdated="May 2026"
    >
      <p>
        This Privacy Policy explains how FoundersLib collects, uses, stores, and protects
        your information when you use the Platform.
      </p>
      <p>By using the Platform, you agree to this Privacy Policy.</p>

      <h2>1. Information We Collect</h2>
      <h3>Information You Provide</h3>
      <p>We may collect:</p>
      <ul>
        <li>Full name</li>
        <li>Email address</li>
        <li>Username and profile details</li>
        <li>Phone number</li>
        <li>Startup and investor information</li>
        <li>Pitch decks and business documents</li>
        <li>Investment preferences</li>
        <li>Messages, posts, and uploaded content</li>
        <li>Payment-related details processed by third parties</li>
      </ul>

      <h3>Information Collected Automatically</h3>
      <p>We may automatically collect:</p>
      <ul>
        <li>IP address</li>
        <li>Browser and device information</li>
        <li>Usage activity and analytics</li>
        <li>Cookies and tracking data</li>
        <li>Platform interaction logs</li>
        <li>
          Authentication tokens stored in your browser&rsquo;s local storage to keep you
          signed in
        </li>
        <li>
          Error and crash diagnostics (via Sentry) when something goes wrong, so we can
          fix it
        </li>
      </ul>

      <h3>Information from Third Parties</h3>
      <p>We may receive information from:</p>
      <ul>
        <li>Payment processors</li>
        <li>KYC and verification providers</li>
        <li>Analytics providers</li>
        <li>Fraud prevention services</li>
        <li>Social login integrations</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <p>We use information to:</p>
      <ul>
        <li>Operate and improve the Platform.</li>
        <li>Facilitate founder&ndash;investor networking.</li>
        <li>Personalize recommendations and insights.</li>
        <li>Enable community and communication features.</li>
        <li>Process subscriptions and payments.</li>
        <li>Improve startup support services.</li>
        <li>Detect fraud and abuse.</li>
        <li>Comply with legal obligations.</li>
      </ul>
      <p>
        <strong>We do not sell personal information.</strong>
      </p>

      <h2>3. Legal Basis for Processing</h2>
      <p>We process information based on:</p>
      <ul>
        <li>User consent.</li>
        <li>Contractual necessity.</li>
        <li>Legal obligations.</li>
        <li>Legitimate business interests.</li>
      </ul>

      <h2>4. Disclosure of Information</h2>
      <p>We may share information with:</p>
      <ul>
        <li>Other users for networking purposes.</li>
        <li>Service providers and infrastructure partners.</li>
        <li>Payment and verification providers.</li>
        <li>Legal authorities where required.</li>
      </ul>
      <p>We only share information necessary to operate the Platform.</p>

      <h2>5. Data Retention</h2>
      <p>We retain data only as long as necessary to:</p>
      <ul>
        <li>Provide services.</li>
        <li>Meet legal obligations.</li>
        <li>Resolve disputes.</li>
        <li>Enforce agreements.</li>
      </ul>
      <p>Data may be securely deleted or anonymized afterward.</p>

      <h2>6. Security</h2>
      <p>We implement technical and organizational safeguards to protect information.</p>
      <p>
        However, no platform is completely secure, and users share information at their own
        risk.
      </p>

      <h2>7. Your Rights</h2>
      <p>Depending on your location, you may have rights to:</p>
      <ul>
        <li>Access data</li>
        <li>Correct inaccuracies</li>
        <li>Delete information</li>
        <li>Restrict processing</li>
        <li>Withdraw consent</li>
        <li>Request data portability</li>
      </ul>
      <p>
        For requests, contact:{' '}
        <a href="mailto:support@founderslib.in">support@founderslib.in</a>
      </p>

      <h2>8. Cookies and Tracking</h2>
      <p>
        We use a small number of cookies and browser storage mechanisms strictly necessary
        for the Platform to function:
      </p>
      <ul>
        <li>
          <strong>Authentication tokens</strong> stored in your browser&rsquo;s local
          storage to keep you signed in.
        </li>
        <li>
          <strong>Session and CSRF cookies</strong> (set by our backend) for request
          security when enabled.
        </li>
        <li>
          <strong>Theme preference</strong> stored locally so we remember whether you
          chose light or dark mode.
        </li>
      </ul>
      <p>
        We currently do not use third-party analytics, advertising, or marketing trackers.
        If we add them in the future, this policy will be updated and consent will be
        obtained where required by law.
      </p>
      <p>Users may manage cookies and storage through browser settings.</p>

      <h2>9. Children&rsquo;s Privacy</h2>
      <p>The Platform is not intended for individuals under 18 years of age.</p>
      <p>We do not knowingly collect data from minors.</p>

      <h2>10. Third-Party Links</h2>
      <p>The Platform may contain third-party links or integrations.</p>
      <p>We are not responsible for external privacy practices.</p>

      <h2>11. International Data Transfers</h2>
      <p>
        Your information may be stored or processed in jurisdictions where our service
        providers operate.
      </p>
      <p>We take reasonable steps to ensure appropriate safeguards are in place.</p>

      <h2>12. Changes to This Policy</h2>
      <p>We may update this Privacy Policy periodically.</p>
      <p>
        Changes will be reflected with an updated &ldquo;Last Updated&rdquo; date at the
        top of this page.
      </p>

      <h2>13. Contact Us</h2>
      <p>
        Email: <a href="mailto:support@founderslib.in">support@founderslib.in</a>
        <br />
        Web: <a href="https://www.founderslib.in">https://www.founderslib.in</a>
      </p>
    </LegalLayout>
  )
}
