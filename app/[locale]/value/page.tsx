import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Value | Space8',
  description: 'Space Infinity or Space Eternity - Premium snooker experiences',
};

export default function ValuePage() {
  return (
    <main className="min-h-screen bg-black">
      <section className="value-s4-placeholder">
        <img
          src="/images/space-infinity-room-中八桌球-香港新蒲崗.webp"
          alt="Space Infinity"
          className="placeholder-image"
        />
      </section>
    </main>
  );
}
