'use client';

import Link from 'next/link';

export type ContactCardItem = {
  icon: string;
  title: string;
  detail: string;
  subtext: string;
  href?: string;
  external?: boolean;
};

type ContactInfoCardsProps = {
  phone?: string;
  email?: string;
  address?: string;
  whatsapp?: string;
};

function normalizeGhanaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('233')) return `+${digits}`;
  if (digits.startsWith('0')) return `+233${digits.slice(1)}`;
  return digits ? `+233${digits}` : raw;
}

function displayPhone(e164: string): string {
  return e164.startsWith('+') ? e164 : e164;
}

export function buildContactCards({
  phone = '0249628324',
  email = 'info@mamator.com',
  address = 'Accra, Kasoa, Koforidua',
  whatsapp,
}: ContactInfoCardsProps): ContactCardItem[] {
  const e164 = normalizeGhanaPhone(phone);
  const wa = normalizeGhanaPhone(whatsapp || phone);
  const waDigits = wa.replace(/\D/g, '');

  return [
    {
      icon: 'ri-phone-line',
      title: 'Call Us',
      detail: displayPhone(e164),
      subtext: 'Mon-Fri, 8am-6pm GMT',
      href: `tel:${e164.replace(/\s/g, '')}`,
    },
    {
      icon: 'ri-mail-line',
      title: 'Email Us',
      detail: email,
      subtext: 'We respond within 24 hours',
      href: `mailto:${email}`,
    },
    {
      icon: 'ri-whatsapp-line',
      title: 'WhatsApp',
      detail: displayPhone(wa),
      subtext: 'Chat with us instantly',
      href: `https://wa.me/${waDigits}`,
      external: true,
    },
    {
      icon: 'ri-map-pin-line',
      title: 'Visit Us',
      detail: address,
      subtext: 'Mon-Sat, 9am-6pm',
    },
  ];
}

export default function ContactInfoCards(props: ContactInfoCardsProps) {
  const cards = buildContactCards(props);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
      {cards.map((card) => {
        const inner = (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eff6ff] text-[#1a56db] mb-5">
              <i className={`${card.icon} text-xl`} aria-hidden />
            </span>
            <h3 className="text-base font-bold text-gray-900 mb-2">{card.title}</h3>
            <p className="text-[15px] font-medium text-[#1a56db] break-words">{card.detail}</p>
            <p className="mt-2 text-sm text-gray-500">{card.subtext}</p>
          </>
        );

        const className =
          'block h-full rounded-xl border border-gray-200 bg-white p-6 md:p-7 text-left transition-shadow hover:shadow-md';

        if (card.href) {
          return (
            <Link
              key={card.title}
              href={card.href}
              className={className}
              {...(card.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {inner}
            </Link>
          );
        }

        return (
          <div key={card.title} className={className}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
