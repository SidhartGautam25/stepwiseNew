import './globals.css';
import { Providers } from '../components/providers';

export const metadata = {
  title: 'Handrail — Build real software, one step at a time',
  description: 'Guided learn-by-building platform for engineers. Work locally in your editor, push to GitHub Actions for verification.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-theme-bg text-theme-fg antialiased font-sans flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
