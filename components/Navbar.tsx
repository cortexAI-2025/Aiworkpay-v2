'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { useState } from 'react';

interface NavbarProps {
  user?: { email: string; role: string } | null;
}

export default function Navbar({ user }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => signOut({ callbackUrl: '/login' });

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">AW</span>
            </div>
            <span className="font-bold text-xl text-gray-900">Aiworkpay</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center space-x-6">
            {user ? (
              <>
                <Link href="/dashboard" className="text-gray-600 hover:text-brand transition-colors font-medium">Dashboard</Link>
                <Link href="/dashboard/missions" className="text-gray-600 hover:text-brand transition-colors font-medium">Missions</Link>
                <Link href="/dashboard/transactions" className="text-gray-600 hover:text-brand transition-colors font-medium">Transactions</Link>
                <Link href="/dashboard/account" className="text-gray-600 hover:text-brand transition-colors font-medium">Mon compte</Link>
                <button onClick={handleLogout} className="btn-secondary text-sm py-2 px-4">Déconnexion</button>
              </>
            ) : (
              <>
                <Link href="/pricing" className="text-gray-600 hover:text-brand transition-colors font-medium">Tarifs</Link>
                <Link href="/contact" className="text-gray-600 hover:text-brand transition-colors font-medium">Contact</Link>
                <Link href="/login" className="btn-secondary text-sm py-2 px-4">Connexion</Link>
                <Link href="/signup" className="btn-primary text-sm py-2 px-4">Commencer</Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setMenuOpen(!menuOpen)}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden py-4 space-y-2 border-t border-gray-100">
            {user ? (
              <>
                <Link href="/dashboard" className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">Dashboard</Link>
                <Link href="/dashboard/missions" className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">Missions</Link>
                <Link href="/dashboard/transactions" className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">Transactions</Link>
                <Link href="/dashboard/account" className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">Mon compte</Link>
                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg">Déconnexion</button>
              </>
            ) : (
              <>
                <Link href="/pricing" className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">Tarifs</Link>
                <Link href="/contact" className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">Contact</Link>
                <Link href="/login" className="block px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg">Connexion</Link>
                <Link href="/signup" className="block px-4 py-2 text-brand font-semibold hover:bg-brand/5 rounded-lg">Commencer</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
