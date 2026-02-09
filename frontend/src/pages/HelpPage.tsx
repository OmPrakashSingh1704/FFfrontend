import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  HelpCircle,
  MessageSquare,
  BookOpen,
  Mail,
  ChevronDown,
  ExternalLink,
  Search,
  Shield,
} from 'lucide-react'

type FaqItem = {
  question: string
  answer: string
}

const faqs: FaqItem[] = [
  {
    question: 'How do I update my profile?',
    answer:
      'Navigate to your profile page from the dropdown menu in the top-right corner. Click "Edit" to update your name, phone, and upload a profile or background picture.',
  },
  {
    question: 'How do introductions work?',
    answer:
      'You can request introductions to founders or investors through their profile pages. The recipient can accept or decline the request. Both parties are notified of the outcome.',
  },
  {
    question: 'What are trust credits?',
    answer:
      'Trust credits reflect your activity and reputation on the platform. You earn credits through interactions, introductions, and community contributions. Higher credits unlock better leagues and visibility.',
  },
  {
    question: 'How do I connect with investors?',
    answer:
      'Browse the investors directory, view their profiles, and request an introduction. You can also discover investors through the feed or search functionality.',
  },
  {
    question: 'How do I start a chat or video call?',
    answer:
      'Open a conversation from the Chat page and use the call button in the chat header. Both one-on-one and group conversations support real-time messaging and calls.',
  },
  {
    question: 'How do I manage my notification preferences?',
    answer:
      'Go to Settings from the profile dropdown to configure email, push, and chat notification preferences.',
  },
]

export function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredFaqs = searchQuery
    ? faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          faq.answer.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : faqs

  return (
    <section className="content-section">
      <header className="content-header">
        <div>
          <h1>Help & Support</h1>
          <p>Find answers, get in touch, or explore our resources.</p>
        </div>
      </header>

      {/* Quick Links */}
      <div className="help-links-grid">
        <Link to="/app/chat" className="content-card help-link-card" data-testid="help-link-chat">
          <MessageSquare size={24} strokeWidth={1.5} />
          <h3>Live chat</h3>
          <p>Message our support team directly through the chat.</p>
        </Link>

        <Link to="/app/settings" className="content-card help-link-card" data-testid="help-link-settings">
          <Shield size={24} strokeWidth={1.5} />
          <h3>Settings</h3>
          <p>Manage your account, notifications, and connected apps.</p>
        </Link>

        <a
          href="mailto:support@founderslib.com"
          className="content-card help-link-card"
          data-testid="help-link-email"
        >
          <Mail size={24} strokeWidth={1.5} />
          <h3>Email support</h3>
          <p>Send us a detailed message and we'll respond within 24 hours.</p>
        </a>

        <div className="content-card help-link-card">
          <BookOpen size={24} strokeWidth={1.5} />
          <h3>Documentation</h3>
          <p>Browse guides, tutorials, and API reference docs.</p>
          <span className="help-link-badge">Coming soon</span>
        </div>
      </div>

      {/* FAQ */}
      <div className="content-card">
        <div className="settings-section-header">
          <HelpCircle size={18} strokeWidth={1.5} />
          <h2>Frequently asked questions</h2>
        </div>

        <div className="help-search">
          <Search size={16} strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Search questions…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="faq-search"
          />
        </div>

        {filteredFaqs.length === 0 ? (
          <p className="billing-muted">No matching questions found.</p>
        ) : (
          <div className="help-faq-list">
            {filteredFaqs.map((faq, index) => {
              const isOpen = openFaq === index
              return (
                <div key={index} className="help-faq-item">
                  <button
                    type="button"
                    className="help-faq-question"
                    data-testid={`faq-item-${index}`}
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      size={16}
                      className={`help-faq-chevron${isOpen ? ' open' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="help-faq-answer">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Contact CTA */}
      <div className="content-card help-contact-card">
        <ExternalLink size={20} strokeWidth={1.5} />
        <div>
          <h3>Still need help?</h3>
          <p>Our team is available Monday through Friday, 9 AM – 6 PM EST.</p>
        </div>
        <a href="mailto:support@founderslib.com" className="btn primary">
          Contact support
        </a>
      </div>
    </section>
  )
}
