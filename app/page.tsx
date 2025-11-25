import Hero from '@/components/Hero';
import BookingSection from '@/components/BookingSection';
import KendallPersonalHero from '@/components/KendallPersonalHero';
import FooterQuote from '@/components/FooterQuote';

export default function Home() {
  // Landing page for Kendall AI assistant
  return (
    <main className="min-h-screen relative" style={{ zIndex: 1 }}>
      <Hero />
      <BookingSection />
      <KendallPersonalHero />
      <FooterQuote />
    </main>
  );
}
