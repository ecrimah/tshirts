-- Contact form submissions (referenced by app/(store)/contact/page.tsx).
-- Previously missing from schema; contact form insert was no-op.

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for admin listing by date
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON public.contact_submissions (created_at DESC);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (anon or authenticated)
CREATE POLICY "Allow insert for contact form" ON public.contact_submissions
  FOR INSERT WITH CHECK (true);

-- Only staff can read submissions
CREATE POLICY "Staff can view contact submissions" ON public.contact_submissions
  FOR SELECT USING (public.is_admin_or_staff());

-- Optional: staff can update (e.g. mark as read) or delete
CREATE POLICY "Staff can update contact submissions" ON public.contact_submissions
  FOR UPDATE USING (public.is_admin_or_staff()) WITH CHECK (public.is_admin_or_staff());
CREATE POLICY "Staff can delete contact submissions" ON public.contact_submissions
  FOR DELETE USING (public.is_admin_or_staff());
