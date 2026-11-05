import { Navbar } from '../components/layout/Navbar/Navbar';
import { Hero } from '../components/home/Hero';
import { Footer } from '../components/layout/Footer';

export default function HomePage() {
  return (
    <div className="min-h-screen w-full bg-theme-bg text-theme-fg flex flex-col font-sans">
      <Navbar />
      <main className="min-h-[calc(100vh-65px)] flex items-center justify-center">
        <Hero />
      </main>
      <Footer />
    </div>
  );
}
