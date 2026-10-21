import React, { createContext, useContext, useState, useEffect } from 'react';
import { IUser } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: IUser | null;
  token: string | null;
  isLoading: boolean;
  login: (phone: string, pass: string) => Promise<void>;
  logout: () => void;
  quickLogin: (role: 'admin' | 'technician', phone?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<IUser | null>(() => {
    const cached = localStorage.getItem('auth_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('auth_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const verifyUser = async () => {
      if (token) {
        try {
          const res = await authApi.getMe();
          setUser(res.user);
          localStorage.setItem('auth_user', JSON.stringify(res.user));
        } catch (err: any) {
          // Only clear session if backend explicitly rejected the token with 401 Unauthorized
          if (err.response?.status === 401) {
            setUser(null);
            setToken(null);
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
          } else {
            console.warn('[Auth] Session verification encountered temporary network delay. Retaining cached user profile.');
          }
        }
      }
      setIsLoading(false);
    };
    verifyUser();
  }, [token]);

  const login = async (phone: string, pass: string) => {
    const res = await authApi.login(phone, pass);
    localStorage.setItem('auth_token', res.token);
    localStorage.setItem('auth_user', JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  };

  const quickLogin = async (role: 'admin' | 'technician', phone?: string) => {
    if (role === 'admin') {
      await login('9876543210', 'admin123');
    } else {
      const targetPhone = phone || '9876500001';
      await login(targetPhone, 'tech123');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, quickLogin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
