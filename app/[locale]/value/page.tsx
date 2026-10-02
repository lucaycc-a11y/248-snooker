import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import ValueSection4 from '@/components/value/ValueSection4';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('valuePage');
  return {
    title: t('meta_title'),
    description: t('meta_description'),
  };
}

export default function ValuePage() {
  return (
    <main className="min-h-screen bg-black">
      <ValueSection4 />
    </main>
  );
}
