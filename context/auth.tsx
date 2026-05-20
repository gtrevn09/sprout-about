import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type AuthContextType = {
  userId: number | null;
  isLoading: boolean;
  login: (id: number) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  userId: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('userId').then((stored) => {
      if (stored) setUserId(Number(stored));
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (id: number) => {
    await AsyncStorage.setItem('userId', String(id));
    setUserId(id);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem('userId');
    setUserId(null);
  }, []);

  return (
    <AuthContext.Provider value={{ userId, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
