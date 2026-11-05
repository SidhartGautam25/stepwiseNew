import './globals.css';
import { Providers } from '../components/providers';
import { Navbar } from '../components/navbar';

export const metadata = {
  title: 'Handrail — Guided Learn-by-Building Platform',
  description: 'Build real systems locally in your IDE with automated GitHub Actions verification.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Providers>
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto p-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}

