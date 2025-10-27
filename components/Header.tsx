import React from 'react';
import type { User } from '../types';
import { UserCircleIcon } from './icons/UserCircleIcon';
import { LogoutIcon } from './icons/LogoutIcon';

interface HeaderProps {
  user: User;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm sticky top-0 z-40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
        <h1 className="text-xl md:text-2xl font-bold text-indigo-600">Thi trực tuyến ProctorFree</h1>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-gray-700">
            <UserCircleIcon />
            <span className="hidden sm:inline font-medium text-gray-800">{user.name}</span>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center space-x-2 bg-white hover:bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200 border border-gray-300"
            aria-label="Đăng xuất"
          >
            <LogoutIcon />
            <span className="hidden sm:inline">Đăng xuất</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
