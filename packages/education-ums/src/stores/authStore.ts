/**
 * BMI UMS - Authentication Store (Zustand)
 * Centralizes auth state: token, user, login status.
 * Removes prop-drilling of auth state through App → ViewRenderer → Components.
 */
import { create } from '../shims/zustand';
import {
  login as authLogin,
  logout as authLogout,
  verifySession,
  getToken,
  getCurrentUser,
  type User,
} from "../services/authService";

interface AuthState {
  isLoggedIn: boolean;
  isAuthenticating: boolean;
  user: User | null;
  token: string | null;

  /** Check stored session on app startup */
  checkSession: () => Promise<void>;
  /** Login with credentials */
  login: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Logout and clear state */
  logout: () => Promise<void>;
  /** Refresh the access token */
  refreshToken: () => Promise<string | null>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  isAuthenticating: true,
  user: null,
  token: null,

  checkSession: async () => {
    // Guard against the session check taking too long (e.g. server cold start
    // after a fresh deploy). 12s is generous enough for a worker cold boot
    // while still returning promptly when the server is truly offline.
    const timeoutPromise = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), 12000),
    );

    try {
      const isValid = await Promise.race([verifySession(), timeoutPromise]);
      set({
        isLoggedIn: isValid,
        isAuthenticating: false,
        user: isValid ? getCurrentUser() : null,
        token: isValid ? getToken() : null,
      });
    } catch (error) { set({
        isLoggedIn: false,
        isAuthenticating: false,
        user: null,
        token: null,
      });
    }
  },

  login: async (email, password, rememberMe = false) => {
    try {
      const result = await authLogin(email, password, rememberMe);
      if (result.success && result.data) {
        set({
          isLoggedIn: true,
          isAuthenticating: false,
          user: result.data.user,
          token: result.data.token,
        });
        return { success: true };
      }
      return { success: false, error: result.error  };
    } catch (error) { return { success: false, error: "Network error"  };
    }
  },

  logout: async () => {
    await authLogout();
    set({ isLoggedIn: false, user: null, token: null });
  },

  refreshToken: async () => {
    const sessionIsValid = await verifySession();
    set({
      token: null,
      isLoggedIn: sessionIsValid,
      user: sessionIsValid ? getCurrentUser() : null,
    });
    return null;
  },
}));









