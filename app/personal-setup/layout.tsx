'use client';

import { useEffect } from 'react';
import PersonalSetupNavbar from '@/components/PersonalSetupNavbar';

export default function PersonalSetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Hide the main navbar when on personal-setup page
    const mainNavbar = document.getElementById('main-navbar');
    if (mainNavbar) {
      mainNavbar.style.display = 'none';
    }
    
    return () => {
      // Show it again when leaving the page
      if (mainNavbar) {
        mainNavbar.style.display = 'block';
      }
    };
  }, []);

  return (
    <>
      <PersonalSetupNavbar />
      {children}
    </>
  );
}
