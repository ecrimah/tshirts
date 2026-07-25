"use client";

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCMS } from '@/context/CMSContext';
import PageHero from '@/components/PageHero';
import { usePageTitle } from '@/hooks/usePageTitle';
import ContactInfoCards from '@/components/contact/ContactInfoCards';
import { useRecaptcha } from '@/hooks/useRecaptcha';

function ContactForm() {
  usePageTitle('Contact Us');
  const searchParams = useSearchParams();
  const { getSetting } = useCMS();
  const contactPhone = getSetting('contact_phone') || '0249628324';
  const contactEmail = getSetting('contact_email') || 'info@mamator.com';
  const contactAddress = getSetting('contact_address') || 'Accra, Kasoa, Koforidua';
  const contactWhatsapp = getSetting('contact_whatsapp') || getSetting('contact_phone') || '0249628324';
  const [pageContent, setPageContent] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const { getToken, verifying } = useRecaptcha();

  useEffect(() => {
    const order = searchParams.get('order') || '';
    const subject = searchParams.get('subject') || '';
    if (!order && !subject) return;
    setFormData((prev) => ({
      ...prev,
      subject: subject || (order ? `Help with order ${order}` : prev.subject),
      message: order
        ? `Hi, I need help with order ${order}.\n\n`
        : prev.message,
    }));
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    // reCAPTCHA verification
    const isHuman = await getToken('contact');
    if (!isHuman) {
      setSubmitStatus('error');
      setIsSubmitting(false);
      return;
    }

    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'contact',
          payload: formData
        })
      }).catch(err => console.error('Contact notification error:', err));

      setSubmitStatus('success');
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (error) {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const heroTitle = pageContent?.title || 'Get In Touch';
  const heroSubtitle = pageContent?.subtitle || 'Have a question or need assistance?';
  const heroContent = pageContent?.content || 'Our friendly team is here to help. Send us a message using the form below.';

  const faqs = [
    {
      question: 'What are your delivery times?',
      answer: 'Standard delivery takes 2-5 business days within Ghana. Express delivery is available for Accra and Kumasi. We pack every tee order with care.'
    },
    {
      question: 'Do you offer international shipping?',
      answer: 'Currently, we ship within Ghana only. Many of our products are imported from China, so we handle all international logistics on our end. You simply order and receive.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept mobile money (MTN, Vodafone, AirtelTigo) and credit/debit cards through our secure Moolre payment gateway.'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <PageHero
        title="Get In Touch"
        subtitle="Have a question about our collections or your order? We’re here to help."
        backgroundImage="/hero-tee-graphic.jpg"
      />

      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10 pb-4">
        <ContactInfoCards
          phone={contactPhone}
          email={contactEmail}
          address={contactAddress}
          whatsapp={contactWhatsapp}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Send Us a Message</h2>
            <p className="text-gray-600 mb-8">
              Fill out the form below and we'll get back to you as soon as possible.
            </p>

            <form id="contactForm" onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-store-primary/40 focus:border-store-primary text-sm"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-store-primary/40 focus:border-store-primary text-sm"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-store-primary/40 focus:border-store-primary text-sm"
                  placeholder="+233 XX XXX XXXX"
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-store-primary/40 focus:border-store-primary text-sm"
                  placeholder="Order inquiry, product question, etc."
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={6}
                  maxLength={500}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-store-primary/40 focus:border-store-primary resize-none text-sm"
                  placeholder="Tell us how we can help you..."
                ></textarea>
                <p className="text-xs text-gray-500 mt-1">{formData.message.length}/500 characters</p>
              </div>

              {submitStatus === 'success' && (
                <div className="bg-store-surface border border-gray-200 text-store-ink px-4 py-3 rounded-xl">
                  <i className="ri-check-line mr-2"></i>
                  Message sent successfully! We'll respond within 24 hours.
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                  <i className="ri-error-warning-line mr-2"></i>
                  Failed to send message. Please try again or contact us directly.
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || verifying}
                className="w-full bg-store-navy text-white py-4 rounded-xl font-medium hover:bg-store-navy-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                {isSubmitting || verifying ? (verifying ? 'Verifying...' : 'Sending...') : 'Send Message'}
              </button>
            </form>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Quick Answers</h2>
            <p className="text-gray-600 mb-8">
              Find answers to common questions before reaching out
            </p>

            <div className="space-y-4 mb-12">
              {faqs.map((faq, index) => (
                <details key={index} className="bg-gray-50 rounded-xl overflow-hidden">
                  <summary className="px-6 py-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors">
                    {faq.question}
                  </summary>
                  <div className="px-6 pb-4 text-gray-600 leading-relaxed">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Need More Help?</h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Share as much detail as you can in your message so we can assist you quickly and effectively.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center">
          <i className="ri-loader-4-line animate-spin text-3xl text-store-primary" />
        </div>
      }
    >
      <ContactForm />
    </Suspense>
  );
}
