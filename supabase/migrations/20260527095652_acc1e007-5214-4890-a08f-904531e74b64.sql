
-- Fix 1: challenges INSERT — prevent assigning arbitrary partner_id
DROP POLICY IF EXISTS "create own challenges" ON public.challenges;
CREATE POLICY "create own challenges"
ON public.challenges FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND (
    partner_id IS NULL
    OR (
      partnership_id IS NOT NULL
      AND public.is_in_partnership(partnership_id)
      AND EXISTS (
        SELECT 1 FROM public.partnerships p
        WHERE p.id = challenges.partnership_id
          AND p.status = 'active'
          AND (
            (p.partner_a_id = auth.uid() AND p.partner_b_id = challenges.partner_id)
            OR (p.partner_b_id = auth.uid() AND p.partner_a_id = challenges.partner_id)
          )
      )
    )
  )
);

-- Fix 2: profiles SELECT — restrict to self and active partner so phone numbers aren't broadcast
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "profiles readable by self or partner"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.partnerships p
    WHERE p.status = 'active'
      AND (
        (p.partner_a_id = auth.uid() AND p.partner_b_id = profiles.id)
        OR (p.partner_b_id = auth.uid() AND p.partner_a_id = profiles.id)
      )
  )
);

-- Fix 3: weekly_reflections SELECT — partner draft stays private until both submit
DROP POLICY IF EXISTS "see reflections in my partnership" ON public.weekly_reflections;
CREATE POLICY "see reflections in my partnership"
ON public.weekly_reflections FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR (
    public.is_in_partnership(partnership_id)
    AND visibility = 'shared'
    AND submitted_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.weekly_reflections r2
      WHERE r2.partnership_id = weekly_reflections.partnership_id
        AND r2.week_start = weekly_reflections.week_start
        AND r2.owner_id = auth.uid()
        AND r2.submitted_at IS NOT NULL
    )
  )
);
