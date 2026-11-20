import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config/supabase.js'

export { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY as SUPABASE_ANON_KEY }

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
