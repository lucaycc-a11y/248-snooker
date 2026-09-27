import { Metadata } from 'next';
import ValueHeroSection4 from '@/components/value/ValueHeroSection4';

export const metadata: Metadata = {
  title: 'Value | Space8',
  description: 'Space Infinity or Space Eternity - Premium snooker experiences',
};

export default function ValuePage() {
  return (
    <main className="min-h-screen bg-black">
      <ValueHeroSection4 />
      {/* Additional sections can be added here */}
    </main>
  );
}
