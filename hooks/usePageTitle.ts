'use client';

import { useEffect } from 'react';

const SITE_NAME = 'TIWAA PERFUME STYLE HOUSE';

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | Perfumes Wholesale & Retail`;
  }, [title]);
}
