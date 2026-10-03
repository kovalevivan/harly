-- Fictional demonstration records for a freshly created ArtDent workspace.
-- Safe to rerun: it exits if the workspace already has a job.
DO $seed$
#variable_conflict use_variable
DECLARE
  workspace_id text;
  owner_id text;
  role jsonb;
  person jsonb;
  job_id uuid;
  candidate_id uuid;
  stage_id uuid;
BEGIN
  SELECT m.organization_id, u.id INTO workspace_id, owner_id
  FROM "user" u JOIN member m ON m.user_id = u.id
  WHERE lower(u.email) = 'demo@artdent.local' LIMIT 1;
  IF workspace_id IS NULL THEN RAISE EXCEPTION 'Create demo@artdent.local and its workspace first'; END IF;
  IF EXISTS (SELECT 1 FROM jobs j WHERE j.workspace_id = workspace_id) THEN
    RAISE NOTICE 'Workspace already has jobs; demo seed skipped';
    RETURN;
  END IF;

  UPDATE organization SET name = 'Артдент · демо' WHERE id = workspace_id;
  UPDATE workspace_settings SET
    description = 'Демонстрационное пространство подбора персонала для сети стоматологических клиник.',
    website_url = 'https://artdentnn.ru/'
  WHERE organization_id = workspace_id;

  FOR role IN SELECT * FROM jsonb_array_elements($roles$[
    {"slug":"stomatolog-terapevt","title":"Врач-стоматолог терапевт","department":"Врачи","description":"<p>Демонстрационная вакансия для стоматологической клиники в Нижнем Новгороде. Врач ведёт терапевтический приём и объясняет пациентам план лечения.</p>"},
    {"slug":"stomatolog-hirurg","title":"Врач-стоматолог хирург","department":"Врачи","description":"<p>Демонстрационная вакансия. Врач проводит хирургический приём, планирует лечение и работает в команде клиники.</p>"},
    {"slug":"menedzher-prodazh","title":"Менеджер по продажам стоматологических услуг","department":"Продажи","description":"<p>Демонстрационная вакансия. Помогайте пациентам разобраться в планах лечения и сопровождайте обращения до записи.</p>"},
    {"slug":"operator-kontakt-centra","title":"Оператор контакт-центра","department":"Контакт-центр","description":"<p>Демонстрационная вакансия. Принимайте обращения пациентов, помогайте с записью и передавайте сложные вопросы профильным специалистам.</p>"}
  ]$roles$::jsonb) LOOP
    INSERT INTO jobs (workspace_id, created_by_id, slug, title, department, location,
      employment_type, workplace_type, description, status, published_at,
      job_location_country, job_location_region, currency, salary_period)
    VALUES (workspace_id, owner_id, role->>'slug', role->>'title', role->>'department',
      'Нижний Новгород', 'full_time', 'onsite', role->>'description', 'open', now(),
      'RU', 'Нижегородская область', 'RUB', 'monthly') RETURNING id INTO job_id;
    INSERT INTO job_stages (workspace_id, job_id, name, "order") VALUES
      (workspace_id, job_id, 'Applied', 1),
      (workspace_id, job_id, 'Screening', 2),
      (workspace_id, job_id, 'Interview', 3),
      (workspace_id, job_id, 'Offer', 4),
      (workspace_id, job_id, 'Hired', 5),
      (workspace_id, job_id, 'Rejected', 6);
  END LOOP;

  FOR person IN SELECT * FROM jsonb_array_elements($people$[
    {"first":"Алина","last":"Морозова","slug":"stomatolog-terapevt","stage":"Interview","headline":"Врач-стоматолог терапевт · демо"},
    {"first":"Павел","last":"Белов","slug":"stomatolog-terapevt","stage":"Screening","headline":"Врач-стоматолог терапевт · демо"},
    {"first":"Ольга","last":"Соколова","slug":"stomatolog-hirurg","stage":"Applied","headline":"Врач-стоматолог хирург · демо"},
    {"first":"Кирилл","last":"Орлов","slug":"stomatolog-hirurg","stage":"Interview","headline":"Врач-стоматолог хирург · демо"},
    {"first":"Екатерина","last":"Романова","slug":"menedzher-prodazh","stage":"Screening","headline":"Менеджер по продажам · демо"},
    {"first":"Максим","last":"Зайцев","slug":"menedzher-prodazh","stage":"Applied","headline":"Менеджер по продажам · демо"},
    {"first":"Дарья","last":"Крылова","slug":"operator-kontakt-centra","stage":"Interview","headline":"Оператор контакт-центра · демо"},
    {"first":"Игорь","last":"Мельников","slug":"operator-kontakt-centra","stage":"Applied","headline":"Оператор контакт-центра · демо"}
  ]$people$::jsonb) LOOP
    SELECT id INTO job_id FROM jobs WHERE jobs.workspace_id = workspace_id AND slug = person->>'slug';
    SELECT id INTO stage_id FROM job_stages WHERE job_stages.job_id = job_id AND name = person->>'stage';
    INSERT INTO candidates (workspace_id, first_name, last_name, email, headline)
    VALUES (workspace_id, person->>'first', person->>'last',
      'demo-' || job_id::text || '-' || substring(md5(person->>'last'), 1, 8) || '@example.invalid',
      person->>'headline') RETURNING id INTO candidate_id;
    INSERT INTO applications (workspace_id, candidate_id, job_id, current_stage_id,
      source, status, applied_at)
    VALUES (workspace_id, candidate_id, job_id, stage_id, 'Демо · сайт клиники', 'active', now());
  END LOOP;

  SELECT id INTO job_id FROM jobs WHERE jobs.workspace_id = workspace_id AND slug = 'stomatolog-terapevt';
  INSERT INTO job_briefs (workspace_id, created_by_id, job_id, title, answers, profile, generated_draft)
  VALUES (workspace_id, owner_id, job_id, 'Врач-стоматолог терапевт',
    $answers$[
      {"topic":"purpose","question":"Зачем открывается позиция?","answer":"Расширяем команду терапевтического приёма; важно сохранять понятную коммуникацию с пациентами."},
      {"topic":"outcomes","question":"Какой результат ожидаете?","answer":"Через полгода врач самостоятельно ведёт приём и составляет планы лечения."},
      {"topic":"responsibilities","question":"Какие основные задачи?","answer":"Диагностика, терапевтическое лечение, объяснение плана пациенту, документация."},
      {"topic":"mustHave","question":"Что обязательно?","answer":"Профильное медицинское образование и действующая аккредитация по специальности."},
      {"topic":"niceToHave","question":"Что будет преимуществом?","answer":"Опыт работы с цифровой диагностикой."},
      {"topic":"conditions","question":"Какие условия?","answer":"Очный приём в Нижнем Новгороде; график обсуждается на встрече."},
      {"topic":"selection","question":"Как оценить кандидата?","answer":"Обсудить клинический случай и коммуникацию с пациентом."}
    ]$answers$::jsonb,
    $profile${"purpose":"Расширить команду терапевтического приёма","outcomes":["Самостоятельно вести приём","Составлять понятные планы лечения"],"responsibilities":["Диагностика и терапевтическое лечение","Коммуникация с пациентами","Ведение документации"],"mustHave":["Профильное медицинское образование","Действующая аккредитация"],"niceToHave":["Опыт цифровой диагностики"],"conditions":["Очный приём в Нижнем Новгороде","График обсуждается на встрече"],"selection":["Разбор клинического случая","Коммуникация с пациентом"]}$profile$::jsonb,
    $draft${"summary":"В демонстрационной клинике ищем врача-стоматолога терапевта для очного приёма в Нижнем Новгороде.","sections":[{"title":"Задачи","bullets":["Проводить диагностику и терапевтическое лечение","Объяснять пациентам план лечения","Вести медицинскую документацию"]},{"title":"Требования","bullets":["Профильное медицинское образование","Действующая аккредитация по специальности"]}]}$draft$::jsonb);
END $seed$;
