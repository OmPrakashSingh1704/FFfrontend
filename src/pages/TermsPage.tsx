import { LegalLayout } from './LegalLayout'

/**
 * Terms of Service.
 *
 * Placeholder values to review when the legal entity is finalized:
 *   - "FoundersLib" is used as both the platform name AND the operating
 *     company. Swap for the registered private limited company when
 *     incorporated (e.g., "FoundersLib Technologies Private Limited").
 *   - Jurisdiction is Bengaluru, India by default — change in §15 if
 *     your registered office is elsewhere.
 *   - Contact email is support@founderslib.in (matches HelpPage).
 */
export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service — FoundersLib"
      description="Terms governing your access to and use of the FoundersLib platform."
      path="/terms"
      lastUpdated="May 2026"
    >
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the
        FoundersLib website, mobile applications, and related services (collectively, the
        &ldquo;Platform&rdquo;), operated by FoundersLib (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;).
      </p>
      <p>
        By accessing or using the Platform, you agree to be bound by these Terms. If you do
        not agree, you may not use the Platform.
      </p>

      <h2>1. Eligibility</h2>
      <p>You must be at least 18 years old to use the Platform.</p>
      <p>By using the Platform, you represent and warrant that:</p>
      <ul>
        <li>You are legally capable of entering into binding agreements.</li>
        <li>All information you provide is accurate and current.</li>
        <li>Your use of the Platform complies with applicable laws and regulations.</li>
        <li>You are not prohibited from using the Platform under any applicable law.</li>
      </ul>
      <p>
        We reserve the right to suspend or terminate accounts that fail to meet eligibility
        requirements.
      </p>

      <h2>2. Platform Role and Services</h2>
      <p>
        FoundersLib is a technology and community platform designed to connect founders,
        investors, startup professionals, and business communities.
      </p>
      <p>Features may include:</p>
      <ul>
        <li>Founder&ndash;investor networking</li>
        <li>Startup discovery and matchmaking</li>
        <li>Community posts and discussions</li>
        <li>Group chats and collaboration spaces</li>
        <li>Group calls and meetings</li>
        <li>Startup growth insights and analytics</li>
        <li>Investor workflow management tools</li>
        <li>Startup support guidance and informational resources</li>
        <li>Investment tracking dashboards</li>
        <li>Limited pitch submissions and premium subscription features</li>
      </ul>

      <h2>3. Important Disclaimers</h2>
      <h3>No Investment Advice</h3>
      <p>The Platform does not provide:</p>
      <ul>
        <li>Investment advice</li>
        <li>Financial advice</li>
        <li>Legal advice</li>
        <li>Tax advice</li>
      </ul>
      <p>All decisions made through the Platform are solely your responsibility.</p>

      <h3>No Broker or Financial Institution</h3>
      <p>FoundersLib is not:</p>
      <ul>
        <li>A broker-dealer</li>
        <li>An investment advisor</li>
        <li>A bank</li>
        <li>An escrow agent</li>
        <li>A crowdfunding portal</li>
        <li>A financial institution</li>
      </ul>
      <p>
        We do not facilitate securities transactions unless explicitly stated and legally
        compliant.
      </p>

      <h3>Government Program Advisory Disclaimer</h3>
      <p>We may provide informational assistance regarding:</p>
      <ul>
        <li>Startup support programs</li>
        <li>Government schemes</li>
        <li>Incubation opportunities</li>
        <li>Funding initiatives</li>
      </ul>
      <p>However:</p>
      <ul>
        <li>We do not represent any government authority.</li>
        <li>We do not guarantee approvals, grants, or funding.</li>
        <li>Users remain solely responsible for applications and compliance.</li>
      </ul>

      <h3>Escrow and Transactions Disclaimer</h3>
      <p>
        The Platform may allow users to track investments or connect with third-party
        escrow providers. However:
      </p>
      <ul>
        <li>We do not hold or manage funds.</li>
        <li>We do not act as escrow agents.</li>
        <li>
          All escrow or financial arrangements are handled independently by users and
          third parties.
        </li>
      </ul>
      <p>We are not responsible for disputes, losses, fraud, or failed transactions.</p>

      <h3>No Guarantee of Funding</h3>
      <p>We do not guarantee:</p>
      <ul>
        <li>Investments</li>
        <li>Funding success</li>
        <li>Business partnerships</li>
        <li>Startup growth</li>
        <li>Investor responses</li>
        <li>Revenue generation</li>
      </ul>

      <h2>4. Account Registration</h2>
      <p>To access certain features, users may be required to create an account.</p>
      <p>You are responsible for:</p>
      <ul>
        <li>Maintaining account confidentiality.</li>
        <li>Activities occurring under your account.</li>
        <li>Promptly reporting unauthorized access.</li>
      </ul>
      <p>
        We reserve the right to suspend or terminate accounts for violations or suspicious
        activity.
      </p>

      <h2>5. User Content</h2>
      <p>Users may upload or share:</p>
      <ul>
        <li>Pitch decks</li>
        <li>Startup information</li>
        <li>Community posts</li>
        <li>Messages</li>
        <li>Investment updates</li>
        <li>Media and files</li>
      </ul>
      <p>You retain ownership of your content.</p>
      <p>
        By posting content, you grant us a worldwide, non-exclusive, royalty-free license
        to host, display, distribute, and promote such content in connection with
        operating the Platform.
      </p>
      <p>You agree not to upload content that:</p>
      <ul>
        <li>Is fraudulent or misleading.</li>
        <li>Violates intellectual property rights.</li>
        <li>Contains harassment or hate speech.</li>
        <li>Promotes illegal activities.</li>
        <li>Attempts to scam or manipulate users.</li>
      </ul>
      <p>We may remove content at our discretion.</p>

      <h2>6. Community Guidelines</h2>
      <p>Users must maintain professional and respectful communication.</p>
      <p>You agree not to:</p>
      <ul>
        <li>Harass users.</li>
        <li>Share confidential information without authorization.</li>
        <li>Spam communities or chats.</li>
        <li>Manipulate investments or discussions.</li>
        <li>Misrepresent identities or affiliations.</li>
      </ul>
      <p>Violation may result in immediate suspension or permanent bans.</p>

      <h2>7. Investments and Transactions</h2>
      <p>If you engage in investments, fundraising, or financial discussions:</p>
      <ul>
        <li>You acknowledge that all investments involve risk.</li>
        <li>You may lose part or all invested capital.</li>
        <li>You are solely responsible for conducting due diligence.</li>
        <li>You must comply with all applicable securities and tax laws.</li>
      </ul>
      <p>Third-party providers may be used for:</p>
      <ul>
        <li>KYC verification</li>
        <li>Payment processing</li>
        <li>Escrow arrangements</li>
        <li>Compliance checks</li>
      </ul>
      <p>We are not liable for investment outcomes or disputes.</p>

      <h2>8. Free and Paid Features</h2>
      <p>Users may receive limited free platform usage, including:</p>
      <ul>
        <li>Up to 3 free pitches per month.</li>
      </ul>
      <p>Additional pitches or premium features may require payment.</p>
      <p>Premium services may include:</p>
      <ul>
        <li>Advanced networking</li>
        <li>Investor insights</li>
        <li>Workflow management</li>
        <li>Enhanced visibility</li>
        <li>Startup support guidance</li>
      </ul>

      <h2>9. Fees and Payments</h2>
      <p>You agree that:</p>
      <ul>
        <li>Pricing will be disclosed before purchase.</li>
        <li>Payments are processed through third-party providers.</li>
        <li>Fees are non-refundable unless required by law.</li>
        <li>Failure to pay may result in restricted access.</li>
      </ul>
      <p>We may update pricing with notice.</p>

      <h2>10. Intellectual Property</h2>
      <p>
        All Platform software, branding, UI, designs, content, and systems are owned by
        FoundersLib or its licensors.
      </p>
      <p>Users may not:</p>
      <ul>
        <li>Copy</li>
        <li>Reverse engineer</li>
        <li>Distribute</li>
        <li>Resell</li>
        <li>Exploit Platform technology</li>
      </ul>
      <p>without written permission.</p>

      <h2>11. Disclaimer of Warranties</h2>
      <p className="uppercase">
        The Platform is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo;
      </p>
      <p>We disclaim all warranties, including:</p>
      <ul>
        <li>Merchantability</li>
        <li>Fitness for a particular purpose</li>
        <li>Non-infringement</li>
        <li>Accuracy of user content</li>
        <li>Platform availability</li>
      </ul>
      <p>Use of the Platform is at your own risk.</p>

      <h2>12. Limitation of Liability</h2>
      <p className="uppercase">To the maximum extent permitted by law:</p>
      <p>We shall not be liable for:</p>
      <ul>
        <li>Investment losses</li>
        <li>Lost profits or revenue</li>
        <li>Data loss</li>
        <li>Business interruption</li>
        <li>Fraudulent user activity</li>
        <li>Indirect or consequential damages</li>
      </ul>
      <p>
        Total liability shall not exceed the amount paid by you to the Platform during the
        previous 12 months.
      </p>

      <h2>13. Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless FoundersLib, its employees, officers, and
        affiliates from claims arising out of:
      </p>
      <ul>
        <li>Your use of the Platform.</li>
        <li>Your content.</li>
        <li>Your investments or transactions.</li>
        <li>Violation of these Terms or applicable law.</li>
      </ul>

      <h2>14. Termination</h2>
      <p>You may stop using the Platform at any time.</p>
      <p>We may suspend or terminate accounts:</p>
      <ul>
        <li>For Terms violations.</li>
        <li>To comply with legal obligations.</li>
        <li>To protect users or the Platform.</li>
      </ul>
      <p>Termination does not remove obligations incurred before termination.</p>

      <h2>15. Governing Law</h2>
      <p>These Terms shall be governed by the laws of India.</p>
      <p>
        Any disputes shall fall under the jurisdiction of courts located in Bengaluru,
        India.
      </p>

      <h2>16. Changes to Terms</h2>
      <p>We may update these Terms periodically.</p>
      <p>Continued use of the Platform after updates constitutes acceptance of revised Terms.</p>

      <h2>17. Contact Us</h2>
      <p>For support or legal inquiries:</p>
      <p>
        Email: <a href="mailto:support@founderslib.in">support@founderslib.in</a>
        <br />
        Web: <a href="https://www.founderslib.in">https://www.founderslib.in</a>
      </p>
    </LegalLayout>
  )
}
