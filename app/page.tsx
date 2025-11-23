import Hero from '@/components/Hero';
import BookingSection from '@/components/BookingSection';
import FooterQuote from '@/components/FooterQuote';

export default function Home() {
  return (
    <main className="min-h-screen relative" style={{ zIndex: 1 }}>
      <Hero />
      <BookingSection />
      <FooterQuote />
    </main>
  );
}
