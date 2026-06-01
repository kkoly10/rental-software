-- security: drop wide-open public UPDATE policy on documents
--
-- Audit finding (manual + Supabase linter rls_policy_always_true):
--   Policy "Portal users can update document status via signing" had
--   qual = true / with_check = (document_status = 'signed'). Any anon
--   caller hitting PostgREST could flip any document in any org to
--   "signed", bypassing the portal token check that lives in app code.
--
-- The token check belongs in code, not in the policy (RLS cannot read
-- the user-supplied token). The portal signing path is being moved to
-- the service-role admin client, which bypasses RLS, so this permissive
-- policy is no longer needed.

DROP POLICY IF EXISTS "Portal users can update document status via signing"
  ON public.documents;
