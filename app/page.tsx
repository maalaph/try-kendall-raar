import Hero from '@/components/Hero';
import BookingSection from '@/components/BookingSection';
import FooterQuote from '@/components/FooterQuote';

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      <BookingSection />
      <FooterQuote />
    </main>
  );
}
