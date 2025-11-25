import PricingPage from '@/components/PricingPage';

export default function Pricing() {
  return (
    <main className="min-h-screen relative" style={{ zIndex: 1 }}>
      <div
        className="w-full min-h-screen"
        style={{ paddingTop: 'clamp(8rem, 12vw, 16rem)', paddingBottom: 'clamp(2rem, 6vw, 8rem)' }}
      >
        <PricingPage />
      </div>
    </main>
  );
}

