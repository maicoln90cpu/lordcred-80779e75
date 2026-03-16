
-- Add perfil column to client_leads (nullable, optional)
ALTER TABLE public.client_leads ADD COLUMN IF NOT EXISTS perfil TEXT DEFAULT NULL;

-- Add lead_profile_options column to system_settings
ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS lead_profile_options JSONB DEFAULT '[
  {"value": "CLT", "label": "CLT", "color_class": "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"},
  {"value": "CLT Clientes", "label": "CLT Clientes", "color_class": "bg-green-500/20 text-green-400 hover:bg-green-500/30"},
  {"value": "FGTS", "label": "FGTS", "color_class": "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"},
  {"value": "FGTS Clientes", "label": "FGTS Clientes", "color_class": "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"}
]'::jsonb;
