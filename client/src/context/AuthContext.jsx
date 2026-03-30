import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    const loadUser = useCallback(async () => {
        try {
            const res = await authAPI.getMe();
            setUser(res.data);
        } catch (err) {
            console.error('[AuthContext] Load user error:', err?.message);
            if (err.response?.status === 401) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setToken(null);
                setUser(null);
            } else {
                const savedUser = localStorage.getItem('user');
                if (savedUser) {
                    try { setUser(JSON.parse(savedUser)); } catch { /* ignore */ }
                }
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (token) {
            loadUser();
        } else {
            setLoading(false);
        }
    }, [token, loadUser]);


    const login = async (email, password) => {
        const res = await authAPI.login({ email, password });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setToken(res.data.token);
        setUser(res.data.user);
        return res.data;
    };

    const register = async (data) => {
        const res = await authAPI.register(data);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setToken(res.data.token);
        setUser(res.data.user);
        return res.data;
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    };

    const updateUser = (updatedUser) => {
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser, loadUser }}>
            {children}
        </AuthContext.Provider>
    );
};
