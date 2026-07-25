import {
  absoluteAsset,
  BRAND_ASSETS,
  getSiteUrl,
  SITE_CONTACT,
  SITE_DEFAULT_DESCRIPTION,
  SITE_LEGAL_NAME,
} from '@/lib/site-brand';

export function getRootStructuredData() {
  const siteUrl = getSiteUrl();
  const logoUrl = absoluteAsset(BRAND_ASSETS.logo);
  const ogUrl = absoluteAsset(BRAND_ASSETS.ogImage);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: SITE_LEGAL_NAME,
        alternateName: 'Mamator',
        url: siteUrl,
        logo: {
          '@type': 'ImageObject',
          url: logoUrl,
          width: 512,
          height: 512,
        },
        image: ogUrl,
        description: SITE_DEFAULT_DESCRIPTION,
        email: SITE_CONTACT.email,
        telephone: SITE_CONTACT.phonePrimary,
        areaServed: {
          '@type': 'Country',
          name: 'Ghana',
        },
        contactPoint: [
          {
            '@type': 'ContactPoint',
            contactType: 'customer service',
            email: SITE_CONTACT.email,
            telephone: SITE_CONTACT.phonePrimary,
            areaServed: SITE_CONTACT.areaServed,
            availableLanguage: ['English'],
          },
          {
            '@type': 'ContactPoint',
            contactType: 'sales',
            telephone: SITE_CONTACT.phoneSecondary,
            areaServed: SITE_CONTACT.areaServed,
            availableLanguage: ['English'],
          },
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: 'Mamator',
        description: SITE_DEFAULT_DESCRIPTION,
        publisher: { '@id': `${siteUrl}/#organization` },
        inLanguage: 'en-GH',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${siteUrl}/shop?search={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'OnlineStore',
        '@id': `${siteUrl}/#store`,
        name: SITE_LEGAL_NAME,
        url: siteUrl,
        image: ogUrl,
        logo: logoUrl,
        description: SITE_DEFAULT_DESCRIPTION,
        email: SITE_CONTACT.email,
        telephone: SITE_CONTACT.phonePrimary,
        address: {
          '@type': 'PostalAddress',
          addressCountry: 'GH',
          addressLocality: SITE_CONTACT.addressLocality,
        },
        priceRange: 'GH₵',
        currenciesAccepted: 'GHS',
        paymentAccepted: 'Mobile Money, Card',
        parentOrganization: { '@id': `${siteUrl}/#organization` },
      },
    ],
  };
}
