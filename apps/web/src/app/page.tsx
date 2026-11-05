import { Navbar } from '../components/layout/Navbar/Navbar';
import { Hero } from '../components/home/Hero';

export default function HomePage() {
  return (
    <div className="h-screen max-h-screen w-full overflow-hidden bg-theme-bg text-theme-fg flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 w-full flex items-center justify-center overflow-hidden">
        <Hero />
      </main>
    </div>
  );
}
