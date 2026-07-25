'use client';

import { useEffect } from 'react';

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Mamator';

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME}`;
  }, [title]);
}
