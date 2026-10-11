-- Presentation cleanup for the existing ArtDent workspace. No records are created or deleted.
-- Candidate data remains fictional; HeadHunter synchronization remains unconnected.
BEGIN;
DO $labels$
DECLARE
  target_workspace text;
BEGIN
  SELECT m.organization_id INTO STRICT target_workspace
  FROM "user" u JOIN member m ON m.user_id = u.id
  WHERE lower(u.email) = 'demo@artdent.local';

  UPDATE organization SET name = 'Артдент'
  WHERE id = target_workspace AND name = 'Артдент · демо';
  UPDATE "user" SET name = 'Администратор Артдент'
  WHERE lower(email) = 'demo@artdent.local' AND name = 'Администратор демо';
  UPDATE workspace_settings
  SET description = 'Подбор персонала для сети стоматологических клиник Артдент.'
  WHERE organization_id = target_workspace
    AND (description IS NULL OR description = ''
      OR description = 'Демонстрационное пространство подбора персонала для сети стоматологических клиник.');
  UPDATE jobs
  SET description = replace(replace(description,
    'Демонстрационная вакансия для стоматологической клиники', 'Вакансия для стоматологической клиники'),
    'Демонстрационная вакансия. ', '')
  WHERE workspace_id = target_workspace AND description LIKE '%Демонстрационная вакансия%';
  UPDATE candidates SET headline = regexp_replace(headline, ' · демо$', '')
  WHERE workspace_id = target_workspace AND headline LIKE '% · демо';
  UPDATE applications SET source = CASE source
    WHEN 'Демо · сайт клиники' THEN 'Сайт клиники'
    WHEN 'HeadHunter · демо' THEN 'Импорт откликов'
    ELSE source END
  WHERE workspace_id = target_workspace AND source IN ('Демо · сайт клиники', 'HeadHunter · демо');
  UPDATE job_briefs SET generated_draft =
    jsonb_set(generated_draft, '{summary}', to_jsonb(replace(generated_draft->>'summary',
      'В демонстрационной клинике', 'В клинике Артдент')))
  WHERE workspace_id = target_workspace AND generated_draft->>'summary' LIKE '%В демонстрационной клинике%';
END $labels$;
COMMIT;
