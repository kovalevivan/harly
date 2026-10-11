-- Move the three previously prepared fictional resumes into actual ATS applications.
-- Append application/candidate links to existing reports; preserve every report and its reference.
-- Rerunnable; no live identities or contact details are introduced.
BEGIN;
DO $link$
DECLARE
  plan record;
  review jsonb;
  linked_reviews jsonb;
  person_id uuid;
  application_id uuid;
  stage_id uuid;
  first_name text;
  last_name text;
  contact_email text;
BEGIN
  FOR plan IN SELECT b.* FROM job_briefs b
    JOIN member m ON m.organization_id=b.workspace_id
    JOIN "user" u ON u.id=m.user_id
    WHERE lower(u.email)='demo@artdent.local'
      AND b.intake->>'caseId'='artdent-call-center-2026' AND b.job_id IS NOT NULL
  LOOP
    linked_reviews := '[]'::jsonb;
    SELECT id INTO stage_id FROM job_stages WHERE job_id=plan.job_id ORDER BY "order" LIMIT 1;
    FOR review IN SELECT value FROM jsonb_array_elements(plan.resume_reviews) LOOP
      IF review->>'applicationId' IS NULL AND review->>'candidateName' IN ('Елена Воронцова','Марина Лебедева','Алексей Миронов') THEN
        first_name := split_part(review->>'candidateName',' ',1);
        last_name := split_part(review->>'candidateName',' ',2);
        contact_email := CASE review->>'candidateName'
          WHEN 'Елена Воронцова' THEN 'elena.vorontsova@candidate.example.invalid'
          WHEN 'Марина Лебедева' THEN 'marina.lebedeva@candidate.example.invalid'
          ELSE 'alexey.mironov@candidate.example.invalid' END;
        SELECT id INTO person_id FROM candidates WHERE workspace_id=plan.workspace_id AND email=contact_email AND deleted_at IS NULL;
        IF person_id IS NULL THEN
          INSERT INTO candidates(workspace_id,first_name,last_name,email,headline)
          VALUES(plan.workspace_id,first_name,last_name,contact_email,'Оператор контакт-центра') RETURNING id INTO person_id;
        END IF;
        SELECT id INTO application_id FROM applications WHERE workspace_id=plan.workspace_id AND candidate_id=person_id AND job_id=plan.job_id;
        IF application_id IS NULL THEN
          INSERT INTO applications(workspace_id,candidate_id,job_id,current_stage_id,source,status)
          VALUES(plan.workspace_id,person_id,plan.job_id,stage_id,'manual','active') RETURNING id INTO application_id;
        END IF;
        review := review || jsonb_build_object('applicationId',application_id::text,'candidateId',person_id::text);
      END IF;
      linked_reviews := linked_reviews || jsonb_build_array(review);
    END LOOP;
    UPDATE job_briefs SET resume_reviews=linked_reviews, updated_at=date_trunc('milliseconds',greatest(now(),updated_at+interval '1 millisecond')) WHERE id=plan.id AND resume_reviews IS DISTINCT FROM linked_reviews;
  END LOOP;
END $link$;
COMMIT;
