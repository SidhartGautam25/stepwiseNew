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
  const { user, status, logout } = useAuth();
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const links: NavLinkItem[] = [
    {
      id: 'workshops',
      label: 'Workshops',
      href: '/workshops',
      isActive: pathname.startsWith('/workshops'),
    },
    ...(user
      ? [
          {
            id: 'dashboard',
            label: 'Dashboard',
            href: '/dashboard',
            isActive: pathname.startsWith('/dashboard'),
          },
        ]
      : []),
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
      logout();
    } else {
      router.push('/login');
    }
  };

  const handleGetStartedClick = () => {
    if (user) {
      router.push('/dashboard');
    } else {
      router.push('/signup');
    }
  };

  return {
    links,
    user,
    status,
    isLoading: status === 'loading',
    isAuthenticated: Boolean(user),
    isLoginModalOpen,
    setIsLoginModalOpen,
    handleLoginClick,
    handleGetStartedClick,
    logout,
  };
}
