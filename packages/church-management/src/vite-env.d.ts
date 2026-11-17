/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_GRAPHQL_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
  readonly VITE_GEMINI_PROXY_URL?: string;
  readonly VITE_AI_API_KEY?: string;
  readonly VITE_SMS_BACKEND_URL?: string;
  readonly DEV?: boolean;
  readonly [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
