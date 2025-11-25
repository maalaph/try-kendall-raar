import ConfiguratorWizard from '@/components/ConfiguratorWizard';

export default function BookPage() {
  return (
    <main className="min-h-screen relative" style={{ zIndex: 1 }}>
      <div
        className="w-full min-h-screen flex items-center justify-center"
        style={{ padding: 'clamp(8rem, 12vw, 16rem) clamp(2rem, 8vw, 10rem) clamp(2rem, 6vw, 8rem) clamp(2rem, 8vw, 10rem)' }}
      >
        <div className="w-full mx-auto flex flex-col items-center justify-center" style={{ maxWidth: '1400px', width: '100%' }}>
          <ConfiguratorWizard />
        </div>
      </div>
    </main>
  );
}

