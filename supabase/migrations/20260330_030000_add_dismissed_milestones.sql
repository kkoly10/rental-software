-- Add dismissed_milestones column to user_guidance_state
-- Tracks which milestone celebration toasts the user has already seen

ALTER TABLE public.user_guidance_state
ADD COLUMN IF NOT EXISTS dismissed_milestones jsonb NOT NULL DEFAULT '[]'::jsonb;
