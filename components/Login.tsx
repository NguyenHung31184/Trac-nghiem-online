import React, { useState } from 'react';
import { LoadingSpinner } from './icons/LoadingSpinner';
import { auth } from '../services/firebase';
import {
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup
} from "firebase/auth";

interface LoginProps {}

const Login: React.FC<LoginProps> = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
        if (err.code === 'auth/invalid-credential') {
            setError('Email hoặc mật khẩu không hợp lệ. Vui lòng kiểm tra lại.');
        } else {
            setError("Đã xảy ra lỗi khi đăng nhập. Vui lòng thử lại.");
        }
        console.error("Firebase login error:", err);
    } finally {
        setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
      setIsLoading(true);
      setError('');
      const provider = new GoogleAuthProvider();
      try {
          await signInWithPopup(auth, provider);
      } catch (err: any) {
          setError("Không thể đăng nhập bằng Google. Vui lòng thử lại.");
          console.error("Google SSO error:", err);
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-4">
      <div className="w-full max-w-md bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl shadow-indigo-100/50 border-t border-gray-200 p-10 sm:p-12 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Chào mừng</h1>
          <p className="mt-2 text-gray-500">Đăng nhập vào Nền tảng Thi trực tuyến</p>
        </div>

        {error && 
          <div className="bg-red-50 border-l-4 border-red-400 text-red-800 p-4 rounded-lg" role="alert">
            <p className="font-bold">Lỗi</p>
            <p>{error}</p>
          </div>
        }

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="transition block w-full px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
              placeholder="email@cuaban.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="transition block w-full px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
              placeholder="Mật khẩu của bạn"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="transition-transform duration-300 hover:scale-105 w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-base font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus-visible:outline-indigo-600 disabled:bg-indigo-500/80 disabled:cursor-not-allowed"
          >
            {isLoading ? <LoadingSpinner /> : 'Đăng nhập'}
          </button>
        </form>
         <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-300/50"></div>
            <span className="flex-shrink mx-4 text-xs text-gray-400 uppercase font-semibold">Hoặc</span>
            <div className="flex-grow border-t border-gray-300/50"></div>
        </div>
         <button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="transition-all duration-300 hover:shadow-md hover:scale-105 w-full flex justify-center items-center py-3.5 px-4 border border-gray-200 rounded-xl shadow-sm text-base font-semibold text-gray-800 bg-white hover:bg-indigo-50/50 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
             {isLoading ? <LoadingSpinner /> : (
                <>
                <svg className="w-5 h-5 mr-3" viewBox="0 0 48 48">
                    <path fill="#4285F4" d="M24 9.5c3.2 0 6.1 1.1 8.4 3.2l6.3-6.3C34.9 2.5 29.8 0 24 0 14.9 0 7.3 5.4 3 13l7.8 6C12.2 13.4 17.7 9.5 24 9.5z"></path>
                    <path fill="#34A853" d="M46.5 24c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.5 2.9-2.2 5.4-4.7 7.1l7.5 5.8c4.4-4.1 7-10 7-17.2z"></path>
                    <path fill="#FBBC05" d="M10.8 28.2c-.3-.9-.5-1.9-.5-2.9s.2-2 .5-2.9l-7.8-6C1.2 19.4 0 21.6 0 24s1.2 4.6 3 6.8l7.8-5.6z"></path>
                    <path fill="#EA4335" d="M24 48c5.8 0 10.9-1.9 14.5-5.2l-7.5-5.8c-1.9 1.3-4.4 2-7 2-6.3 0-11.8-3.9-13.8-9.2L3 31c4.3 7.6 11.9 12.8 21 12.8z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                </svg>
                Đăng nhập với Google
                </>
             )}
        </button>
        <div className="text-center text-sm text-gray-600 pt-6 mt-6 border-t border-slate-200 bg-slate-50 p-5 rounded-xl space-y-2">
            <p className='font-bold text-slate-700'>Để kiểm thử:</p>
            <p className="text-slate-600">Tạo tài khoản học viên và quản trị viên trong Firebase Authentication.</p>
            <p className="text-slate-600">Email quản trị viên: <code className="bg-slate-200 text-slate-700 font-mono px-1.5 py-0.5 rounded-md">admin@example.com</code></p>
        </div>
      </div>
    </div>
  );
};

export default Login;