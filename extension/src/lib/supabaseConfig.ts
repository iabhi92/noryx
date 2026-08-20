// The publishable key is designed to be public — it's embedded in client code by design (same
// trust model as a Stripe publishable key) and can only do what supabase/public_profile.sql
// explicitly grants it: read any profile by id, and write only through functions that check
// write_token first. See that file for the actual access control.
export const SUPABASE_URL = 'https://jliflngpelahaprxsziq.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_v1S6u0JdZ3-E4BuovTxMww_FY_W5iP2';
