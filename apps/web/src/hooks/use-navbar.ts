import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/auth-context';

export interface NavLinkItem {
  id: string;
  label: string;
  href: string;
  isActive: boolean;
}

export function useNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, signOut, signInWithGitHub } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const links: NavLinkItem[] = [
    {
      id: 'workshops',
      label: 'Workshops',
      href: '/workshops',
      isActive: pathname.startsWith('/workshops'),
    },
    {
      id: 'reviews',
      label: 'Reviews',
      href: '#reviews',
      isActive: false,
    },
    {
      id: 'docs',
      label: 'Docs',
      href: '#docs',
      isActive: false,
    },
  ];

  const handleLoginClick = () => {
    if (user) {
      signOut();
    } else {
      // In development, trigger GitHub sign-in or redirect
      signInWithGitHub();
    }
  };

  const handleGetStartedClick = () => {
    router.push('/workshops');
  };

  return {
    links,
    user,
    token,
    isAuthenticated: Boolean(user),
    isLoginModalOpen,
    setIsLoginModalOpen,
    handleLoginClick,
    handleGetStartedClick,
  };
}

