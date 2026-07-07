import { createClient } from '@supabase/supabase-js'

// Clave publicable (diseñada para ir en el cliente). La seguridad real
// la dan las políticas RLS del servidor; en fase 2 se suma Auth con login.
const URL = 'https://wtvbdqnisbwsjiwjdkif.supabase.co'
const PUBLISHABLE_KEY = 'sb_publishable_D9k9HNdhN1N063tPU9lm3w_wWFWpySW'

export const supabase = createClient(URL, PUBLISHABLE_KEY)
