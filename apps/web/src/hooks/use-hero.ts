import { useRouter } from 'next/navigation';

export interface HeroFeaturePill {
  id: string;
  label: string;
}

export function useHero() {
  const router = useRouter();

  const bannerText = 'No browser IDE. Your editor, your machine.';

  const featurePills: HeroFeaturePill[] = [
    { id: 'levels', label: '3 explanation levels' },
    { id: 'starters', label: 'Starters in your language' },
    { id: 'actions', label: 'Tests run on GitHub Actions' },
  ];

  const handleBrowseWorkshops = () => {
    router.push('/workshops');
  };

  const handleReadReviews = () => {
    // Navigate or scroll to reviews
    const el = document.getElementById('reviews');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      router.push('/workshops');
    }
  };

  return {
    bannerText,
    featurePills,
    handleBrowseWorkshops,
    handleReadReviews,
  };
}

