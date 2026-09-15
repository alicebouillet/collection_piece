import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    "Variables Supabase manquantes. Copie .env.example en .env et renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.",
  )
}

export const supabase = createClient(url, key)
