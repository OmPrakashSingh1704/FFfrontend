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
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Help & Support</h1>
          <p className="page-description">Find answers, get in touch, or explore our resources.</p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="section">
        <p className="section-label">Quick Links</p>
        <div className="grid-2">
          <Link to="/app/chat" className="card" data-testid="help-link-chat" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MessageSquare size={18} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 4 }}>Live Chat</h3>
                <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
                  Message our support team directly through the chat.
                </p>
              </div>
            </div>
          </Link>

          <Link to="/app/settings" className="card" data-testid="help-link-settings" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Shield size={18} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 4 }}>Settings</h3>
                <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
                  Manage your account, notifications, and connected apps.
                </p>
              </div>
            </div>
          </Link>

          <a href="mailto:support@founderslib.com" className="card" data-testid="help-link-email" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Mail size={18} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 4 }}>Email Support</h3>
                <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
                  Send us a detailed message and we'll respond within 24 hours.
                </p>
              </div>
            </div>
          </a>

          <div className="card" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BookOpen size={18} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 4 }}>Documentation</h3>
                <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.5 }}>
                  Browse guides, tutorials, and API reference docs.
                </p>
              </div>
            </div>
            <span className="badge info" style={{ position: 'absolute', top: 12, right: 12 }}>Coming soon</span>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="section">
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <HelpCircle size={16} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
              <span className="card-title">Frequently Asked Questions</span>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <Search
              size={15}
              strokeWidth={1.5}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'hsl(var(--muted-foreground))',
              }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="faq-search"
              style={{ paddingLeft: 32 }}
            />
          </div>

          {/* FAQ list */}
          {filteredFaqs.length === 0 ? (
            <div className="empty-state" style={{ paddingTop: 32, paddingBottom: 32 }}>
              <Search className="empty-icon" />
              <p className="empty-title">No matching questions</p>
              <p className="empty-description">Try adjusting your search terms.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredFaqs.map((faq, index) => {
                const isOpen = openFaq === index
                return (
                  <div
                    key={index}
                    style={{
                      borderBottom: index < filteredFaqs.length - 1 ? '1px solid hsl(var(--border))' : 'none',
                    }}
                  >
                    <button
                      type="button"
                      data-testid={`faq-item-${index}`}
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 0',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'hsl(var(--foreground))',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        textAlign: 'left',
                      }}
                    >
                      <span>{faq.question}</span>
                      <ChevronDown
                        size={16}
                        strokeWidth={1.5}
                        style={{
                          color: 'hsl(var(--muted-foreground))',
                          transition: 'transform 200ms ease',
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          flexShrink: 0,
                          marginLeft: 12,
                        }}
                      />
                    </button>
                    {isOpen && (
                      <div style={{ paddingBottom: 14 }}>
                        <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))', lineHeight: 1.6 }}>
                          {faq.answer}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Contact CTA */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ExternalLink size={18} strokeWidth={1.5} style={{ color: 'var(--gold)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 2 }}>Still need help?</h3>
          <p style={{ fontSize: '0.8125rem', color: 'hsl(var(--muted-foreground))' }}>
            Our team is available Monday through Friday, 9 AM - 6 PM EST.
          </p>
        </div>
        <a href="mailto:support@founderslib.com" className="btn-sm primary" style={{ textDecoration: 'none' }}>
          <Mail size={14} strokeWidth={1.5} />
          Contact support
        </a>
      </div>
    </div>
  )
}
