/**
 * Frontend Concurrency & Real-Time Support - PHASE 5
 * 
 * Provides client-side utilities for:
 * 1. Cross-tab session synchronization (sync logout across tabs)
 * 2. Real-time dashboard polling (auto-refresh every 5-10 seconds)
 * 3. Session isolation (prevent conflicts with other users)
 * 4. Automatic token refresh before expiration
 */

/**
 * Session Storage Manager
 * Provides isolated, safe session storage across browser tabs/windows
 * 
 * Features:
 * - StorageEvent listener for cross-tab sync
 * - Automatic cleanup on logout
 * - Secure localStorage operations
 * - CRITICAL FIX: Proper event listener cleanup to prevent memory leaks
 */
export class SessionStorageManager {
    constructor() {
        this.storageKey = 'placement_session';
        this.tokenKey = 'placement_token';
        this.userKey = 'placement_user';
        this.expiryKey = 'placement_token_expiry';
        this.storageListener = null; // Store listener reference for cleanup
        this.setupCrossTabSync();
    }

    /**
     * Listen for storage changes from other tabs/windows
     * Ensures logout in one tab logs out all tabs
     * CRITICAL FIX: Store listener reference for proper cleanup
     */
    setupCrossTabSync() {
        if (typeof window !== 'undefined') {
            // Create and store the listener function for proper cleanup
            this.storageListener = (event) => {
                // If token was cleared in another tab, clear it here too
                if (event.key === this.tokenKey && event.newValue === null) {
                    this.clearSession();
                    // Optionally dispatch event for React components
                    window.dispatchEvent(new CustomEvent('session-logged-out'));
                }
                
                // If token was set (login in another tab), refresh here
                if (event.key === this.tokenKey && event.newValue && !this.getToken()) {
                    window.dispatchEvent(new CustomEvent('session-logged-in', {
                        detail: { token: event.newValue }
                    }));
                }
            };
            
            window.addEventListener('storage', this.storageListener);
        }
    }

    /**
     * CRITICAL FIX: Cleanup - Remove storage listener to prevent memory leaks
     * Must be called on component unmount or logout
     */
    cleanup() {
        if (typeof window !== 'undefined' && this.storageListener) {
            window.removeEventListener('storage', this.storageListener);
            this.storageListener = null;
        }
    }

    /**
     * Save session (called after successful login)
     */
    setSession(token, user, expiryTime) {
        try {
            localStorage.setItem(this.tokenKey, token);
            localStorage.setItem(this.userKey, JSON.stringify(user));
            localStorage.setItem(this.expiryKey, expiryTime.toString());
            
            return true;
        } catch (error) {
            console.error('[SESSION] Failed to save session:', error);
            return false;
        }
    }

    /**
     * Get current stored token
     */
    getToken() {
        try {
            return localStorage.getItem(this.tokenKey);
        } catch (error) {
            console.error('[SESSION] Failed to retrieve token:', error);
            return null;
        }
    }

    /**
     * Get current stored user info
     */
    getUser() {
        try {
            const userJson = localStorage.getItem(this.userKey);
            return userJson ? JSON.parse(userJson) : null;
        } catch (error) {
            console.error('[SESSION] Failed to retrieve user:', error);
            return null;
        }
    }

    /**
     * Check if token is expired
     */
    isTokenExpired() {
        try {
            const expiryStr = localStorage.getItem(this.expiryKey);
            if (!expiryStr) return true;
            
            const expiry = parseInt(expiryStr);
            const now = Date.now();
            
            // Consider token expired if less than 1 minute remaining
            return now >= (expiry - 60000);
        } catch (error) {
            console.error('[SESSION] Failed to check token expiry:', error);
            return true;
        }
    }

    /**
     * Get minutes until token expiry
     */
    getMinutesUntilExpiry() {
        try {
            const expiryStr = localStorage.getItem(this.expiryKey);
            if (!expiryStr) return 0;
            
            const expiry = parseInt(expiryStr);
            const now = Date.now();
            const msRemaining = expiry - now;
            
            if (msRemaining <= 0) return 0;
            return Math.ceil(msRemaining / 60000);
        } catch (error) {
            console.error('[SESSION] Failed to calculate expiry:', error);
            return 0;
        }
    }

    /**
     * Clear session (called on logout)
     */
    clearSession() {
        try {
            localStorage.removeItem(this.tokenKey);
            localStorage.removeItem(this.userKey);
            localStorage.removeItem(this.expiryKey);
            
            // Notify other tabs about logout
            window.dispatchEvent(new CustomEvent('session-cleared'));
            return true;
        } catch (error) {
            console.error('[SESSION] Failed to clear session:', error);
            return false;
        }
    }
}

/**
 * Real-Time Dashboard Polling Manager
 * Automatically polls dashboard endpoints and updates state
 * 
 * Features:
 * - Configurable polling interval (5-10 seconds)
 * - Automatic backoff on errors
 * - Smart update detection (only notify if data changed)
 * - Cleanup on unmount
 */
export class DashboardPollingManager {
    constructor(apiClient, userId, role) {
        this.apiClient = apiClient;
        this.userId = userId;
        this.role = role;
        this.pollingInterval = 5000; // 5 seconds
        this.pollTimer = null;
        this.listeners = [];
        this.lastData = null;
        this.errorCount = 0;
        this.maxErrors = 5;
    }

    /**
     * Start polling for dashboard updates
     */
    start() {
        console.log(`[POLLING] Started for ${this.role} dashboard (interval: ${this.pollingInterval}ms)`);
        
        // First poll immediately
        this.poll();
        
        // Then poll periodically
        this.pollTimer = setInterval(() => this.poll(), this.pollingInterval);
    }

    /**
     * Stop polling
     */
    stop() {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
            console.log('[POLLING] Stopped');
        }
    }

    /**
     * Single poll operation
     */
    async poll() {
        try {
            let endpoint = '';
            
            // Determine which endpoint based on user role
            if (this.role === 'admin') {
                endpoint = '/admin/dashboard/summary';
            } else if (this.role === 'student') {
                endpoint = `/student/dashboard/${this.userId}/summary`;
            } else if (this.role === 'recruiter') {
                endpoint = `/recruiter/dashboard/${this.userId}/summary`;
            } else {
                return;
            }

            const response = await this.apiClient.get(endpoint);
            
            if (response.data && response.data.data) {
                const newData = response.data.data;
                
                // Check if data actually changed
                if (!this.dataEquals(this.lastData, newData)) {
                    this.lastData = newData;
                    this.notifyListeners(newData);
                }
                
                // Reset error count on success
                this.errorCount = 0;
            }
        } catch (error) {
            this.errorCount++;
            
            if (this.errorCount === 1) {
                console.warn('[POLLING] Error fetching dashboard:', error.message);
            }
            
            // Stop polling after too many errors
            if (this.errorCount >= this.maxErrors) {
                console.error('[POLLING] Too many errors - stopping polling');
                this.stop();
            }
        }
    }

    /**
     * Check if two data objects are equal (to avoid unnecessary updates)
     */
    dataEquals(data1, data2) {
        if (!data1 || !data2) return false;
        return JSON.stringify(data1) === JSON.stringify(data2);
    }

    /**
     * Subscribe to dashboard updates
     */
    subscribe(callback) {
        this.listeners.push(callback);
        
        // Return unsubscribe function
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    /**
     * Notify all listeners of data change
     */
    notifyListeners(data) {
        this.listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('[POLLING] Listener error:', error);
            }
        });
    }
}

/**
 * Token Expiry Monitor
 * Warn user before token expires and auto-logout if expired
 * 
 * Features:
 * - Shows warning at 5 minutes before expiry
 * - Shows critical warning at 1 minute
 * - Auto-logout when expired
 */
export class TokenExpiryMonitor {
    constructor(sessionManager, apiClient) {
        this.sessionManager = sessionManager;
        this.apiClient = apiClient;
        this.checkInterval = 30000; // Check every 30 seconds
        this.checkTimer = null;
        this.warningShown5min = false;
        this.warningShown1min = false;
        this.warningCallbacks = [];
    }

    /**
     * Start monitoring token expiry
     */
    start() {
        console.log('[TOKEN_MONITOR] Started');
        
        this.checkTimer = setInterval(() => this.checkAndWarn(), this.checkInterval);
        // Also check immediately
        this.checkAndWarn();
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
            this.checkTimer = null;
            console.log('[TOKEN_MONITOR] Stopped');
        }
    }

    /**
     * Check token expiry and show warnings
     */
    checkAndWarn() {
        if (this.sessionManager.isTokenExpired()) {
            // Token expired - force logout
            console.warn('[TOKEN_MONITOR] Token expired - forcing logout');
            this.notifyWarning('Token expired', 'critical');
            this.sessionManager.clearSession();
            this.stop();
            window.dispatchEvent(new CustomEvent('token-expired'));
            return;
        }

        const minutesRemaining = this.sessionManager.getMinutesUntilExpiry();

        // Show 5-minute warning
        if (minutesRemaining <= 5 && !this.warningShown5min) {
            this.warningShown5min = true;
            console.warn('[TOKEN_MONITOR] 5 minutes until token expiry');
            this.notifyWarning(`Your session expires in 5 minutes. Please save your work.`, 'warning');
        }

        // Show 1-minute critical warning
        if (minutesRemaining <= 1 && !this.warningShown1min) {
            this.warningShown1min = true;
            console.warn('[TOKEN_MONITOR] 1 minute until token expiry');
            this.notifyWarning(`Your session expires in 1 minute. Please save immediately!`, 'critical');
        }
    }

    /**
     * Subscribe to token expiry warnings
     */
    onWarning(callback) {
        this.warningCallbacks.push(callback);
    }

    /**
     * Notify subscribers of warnings
     */
    notifyWarning(message, level = 'warning') {
        this.warningCallbacks.forEach(callback => {
            try {
                callback({ message, level, timestamp: new Date() });
            } catch (error) {
                console.error('[TOKEN_MONITOR] Warning callback error:', error);
            }
        });
    }
}

/**
 * React Hook: useSession
 * Provides session state and methods to React components
 * 
 * Usage:
 * const { token, user, logout, isExpired } = useSession();
 */
export function useSession() {
    const [sessionManager] = React.useState(() => new SessionStorageManager());
    const [token, setToken] = React.useState(sessionManager.getToken());
    const [user, setUser] = React.useState(sessionManager.getUser());

    React.useEffect(() => {
        // Setup listeners for cross-tab sync
        const handleLogout = () => {
            setToken(null);
            setUser(null);
        };

        const handleLogin = (event) => {
            const newToken = event.detail?.token || sessionManager.getToken();
            setToken(newToken);
            setUser(sessionManager.getUser());
        };

        window.addEventListener('session-logged-out', handleLogout);
        window.addEventListener('session-logged-in', handleLogin);

        return () => {
            window.removeEventListener('session-logged-out', handleLogout);
            window.removeEventListener('session-logged-in', handleLogin);
        };
    }, [sessionManager]);

    return {
        token,
        user,
        setSession: (token, user, expiry) => {
            sessionManager.setSession(token, user, expiry);
            setToken(token);
            setUser(user);
        },
        logout: () => {
            sessionManager.clearSession();
            setToken(null);
            setUser(null);
        },
        isExpired: sessionManager.isTokenExpired(),
        minutesUntilExpiry: sessionManager.getMinutesUntilExpiry()
    };
}

/**
 * React Hook: useDashboardPolling
 * Auto-polls dashboard and provides live-updating data
 * 
 * Usage:
 * const dashboardData = useDashboardPolling(apiClient, userId, role);
 */
export function useDashboardPolling(apiClient, userId, role) {
    const [data, setData] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(null);
    const pollerRef = React.useRef(null);

    React.useEffect(() => {
        if (!apiClient || !role) return;

        // Create and start poller
        const poller = new DashboardPollingManager(apiClient, userId, role);
        pollerRef.current = poller;

        // Subscribe to updates
        poller.subscribe((newData) => {
            setData(newData);
            setLoading(false);
            setError(null);
        });

        poller.start();

        // Cleanup
        return () => {
            if (pollerRef.current) {
                pollerRef.current.stop();
            }
        };
    }, [apiClient, userId, role]);

    return { data, loading, error };
}

export default {
    SessionStorageManager,
    DashboardPollingManager,
    TokenExpiryMonitor,
    useSession,
    useDashboardPolling
};
