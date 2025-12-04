'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export default function ConditionalNavbar() {
  const pathname = usePathname();
  
  // Hide navbar on dashboard, chat, integrations, and personal-setup pages
  const hideNavbarRoutes = ['/dashboard', '/chat', '/integrations', '/personal-setup'];
  const shouldHideNavbar = hideNavbarRoutes.some(route => pathname?.startsWith(route));
  
  if (shouldHideNavbar) {
    return null;
  }
  
  return (
    <div id="main-navbar">
      <Navbar />
    </div>
  );
}


