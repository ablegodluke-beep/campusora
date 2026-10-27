import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ssdhygwozbroqjhuecgp.supabase.co';

const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_gbbFNsXzzJSh8k3aqEl4kg_XO-YRo4N';

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage
    }
  }
);
