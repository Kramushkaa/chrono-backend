# Структура базы данных — Хронониндзя

Автоматически сгенерировано из текущей базы (schema public). Параметры подключения берутся из переменных окружения `DB_*`.

## Таблицы

### achievements

| Колонка | Тип | NULL | По умолчанию |
|---|---|:--:|---|
| id | integer | NO | nextval('achievements_id_seq'::regclass) |
| person_id | character varying | YES |  |
| year | integer | NO |  |
| description | text | NO |  |
| wikipedia_url | text | YES |  |
| image_url | text | YES |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| country_id | integer | YES |  |
| status | text | NO | 'approved'::text |
| created_by | integer | YES |  |
| updated_by | integer | YES |  |
| submitted_at | timestamp without time zone | YES |  |
| reviewed_at | timestamp without time zone | YES |  |
| reviewed_by | integer | YES |  |
| review_comment | text | YES |  |
| is_draft | boolean | NO | false |
| draft_saved_at | timestamp without time zone | YES |  |
| last_edited_at | timestamp without time zone | YES |  |

- **Первичный ключ**: id
- **Внешние ключи**:
- achievements_country_id_fkey: (country_id) → countries(id) ON DELETE SET NULL ON UPDATE NO ACTION
- fk_achievements_created_by: (created_by) → users(id) ON DELETE SET NULL ON UPDATE NO ACTION
- fk_achievements_person: (person_id) → persons(id) ON DELETE SET NULL ON UPDATE NO ACTION
- fk_achievements_reviewed_by: (reviewed_by) → users(id) ON DELETE SET NULL ON UPDATE NO ACTION
- **Индексы**:
  - achievements_pkey: CREATE UNIQUE INDEX achievements_pkey ON public.achievements USING btree (id)
  - achievements_unique_country_year_desc: CREATE UNIQUE INDEX achievements_unique_country_year_desc ON public.achievements USING btree (country_id, year, lower(btrim(description))) WHERE ((country_id IS NOT NULL) AND (person_id IS NULL))
  - achievements_unique_global_year_desc: CREATE UNIQUE INDEX achievements_unique_global_year_desc ON public.achievements USING btree (year, lower(btrim(description))) WHERE ((person_id IS NULL) AND (country_id IS NULL))
  - achievements_unique_person_year_desc: CREATE UNIQUE INDEX achievements_unique_person_year_desc ON public.achievements USING btree (person_id, year, lower(btrim(description))) WHERE (person_id IS NOT NULL)
  - idx_achievements_country_id: CREATE INDEX idx_achievements_country_id ON public.achievements USING btree (country_id)
  - idx_achievements_created_by: CREATE INDEX idx_achievements_created_by ON public.achievements USING btree (created_by)
  - idx_achievements_description_trgm: CREATE INDEX idx_achievements_description_trgm ON public.achievements USING gin (description gin_trgm_ops)
  - idx_achievements_draft_saved_at: CREATE INDEX idx_achievements_draft_saved_at ON public.achievements USING btree (draft_saved_at)
  - idx_achievements_is_draft: CREATE INDEX idx_achievements_is_draft ON public.achievements USING btree (is_draft)
  - idx_achievements_person_id: CREATE INDEX idx_achievements_person_id ON public.achievements USING btree (person_id)
  - idx_achievements_status: CREATE INDEX idx_achievements_status ON public.achievements USING btree (status)
  - idx_achievements_submitted_at: CREATE INDEX idx_achievements_submitted_at ON public.achievements USING btree (submitted_at)
  - idx_achievements_year: CREATE INDEX idx_achievements_year ON public.achievements USING btree (year)
  - uniq_achievements_country_year_desc: CREATE UNIQUE INDEX uniq_achievements_country_year_desc ON public.achievements USING btree (country_id, year, lower(btrim(description))) WHERE ((country_id IS NOT NULL) AND (person_id IS NULL))
  - uniq_achievements_person_year_desc: CREATE UNIQUE INDEX uniq_achievements_person_year_desc ON public.achievements USING btree (person_id, year, lower(btrim(description))) WHERE (person_id IS NOT NULL)

### countries

| Колонка | Тип | NULL | По умолчанию |
|---|---|:--:|---|
| id | integer | NO | nextval('countries_id_seq'::regclass) |
| name | text | NO |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

- **Первичный ключ**: id
- **Индексы**:
  - countries_name_key: CREATE UNIQUE INDEX countries_name_key ON public.countries USING btree (name)
  - countries_pkey: CREATE UNIQUE INDEX countries_pkey ON public.countries USING btree (id)
  - idx_countries_name: CREATE INDEX idx_countries_name ON public.countries USING btree (name)

### list_items

| Колонка | Тип | NULL | По умолчанию |
|---|---|:--:|---|
| id | integer | NO | nextval('list_items_id_seq'::regclass) |
| list_id | integer | NO |  |
| item_type | text | NO |  |
| person_id | character varying | YES |  |
| achievement_id | integer | YES |  |
| period_id | integer | YES |  |
| period_json | jsonb | YES |  |
| position | integer | YES | 0 |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

- **Первичный ключ**: id
- **Внешние ключи**:
- list_items_achievement_id_fkey: (achievement_id) → achievements(id) ON DELETE CASCADE ON UPDATE NO ACTION
- list_items_list_id_fkey: (list_id) → lists(id) ON DELETE CASCADE ON UPDATE NO ACTION
- list_items_period_id_fkey: (period_id) → periods(id) ON DELETE CASCADE ON UPDATE NO ACTION
- list_items_person_id_fkey: (person_id) → persons(id) ON DELETE CASCADE ON UPDATE NO ACTION
- **Индексы**:
  - idx_list_items_list: CREATE INDEX idx_list_items_list ON public.list_items USING btree (list_id)
  - idx_list_items_list_id: CREATE INDEX idx_list_items_list_id ON public.list_items USING btree (list_id)
  - idx_list_items_unique_achievement: CREATE INDEX idx_list_items_unique_achievement ON public.list_items USING btree (list_id, item_type, achievement_id)
  - idx_list_items_unique_period: CREATE INDEX idx_list_items_unique_period ON public.list_items USING btree (list_id, item_type, period_id)
  - idx_list_items_unique_person: CREATE INDEX idx_list_items_unique_person ON public.list_items USING btree (list_id, item_type, person_id)
  - list_items_pkey: CREATE UNIQUE INDEX list_items_pkey ON public.list_items USING btree (id)
  - uq_list_items_achievement: CREATE UNIQUE INDEX uq_list_items_achievement ON public.list_items USING btree (list_id, item_type, achievement_id) WHERE ((item_type = 'achievement'::text) AND (achievement_id IS NOT NULL))
  - uq_list_items_period: CREATE UNIQUE INDEX uq_list_items_period ON public.list_items USING btree (list_id, item_type, period_id) WHERE ((item_type = 'period'::text) AND (period_id IS NOT NULL))
  - uq_list_items_person: CREATE UNIQUE INDEX uq_list_items_person ON public.list_items USING btree (list_id, item_type, person_id) WHERE ((item_type = 'person'::text) AND (person_id IS NOT NULL))

### lists

| Колонка | Тип | NULL | По умолчанию |
|---|---|:--:|---|
| id | integer | NO | nextval('lists_id_seq'::regclass) |
| owner_user_id | integer | NO |  |
| title | text | NO |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

- **Первичный ключ**: id
- **Внешние ключи**:
- lists_owner_user_id_fkey: (owner_user_id) → users(id) ON DELETE CASCADE ON UPDATE NO ACTION
- **Индексы**:
  - lists_pkey: CREATE UNIQUE INDEX lists_pkey ON public.lists USING btree (id)

### periods

| Колонка | Тип | NULL | По умолчанию |
|---|---|:--:|---|
| id | integer | NO | nextval('periods_id_seq'::regclass) |
| start_year | integer | NO |  |
| end_year | integer | NO |  |
| person_id | character varying | YES |  |
| country_id | integer | YES |  |
| period_type | character varying | NO |  |
| comment | text | YES |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| status | text | NO | 'approved'::text |
| created_by | integer | YES |  |
| updated_by | integer | YES |  |
| submitted_at | timestamp without time zone | YES |  |
| reviewed_at | timestamp without time zone | YES |  |
| reviewed_by | integer | YES |  |
| review_comment | text | YES |  |
| is_draft | boolean | NO | false |
| draft_saved_at | timestamp without time zone | YES |  |
| last_edited_at | timestamp without time zone | YES |  |

- **Первичный ключ**: id
- **Внешние ключи**:
- fk_periods_country: (country_id) → countries(id) ON DELETE SET NULL ON UPDATE NO ACTION
- fk_periods_created_by: (created_by) → users(id) ON DELETE SET NULL ON UPDATE NO ACTION
- fk_periods_person: (person_id) → persons(id) ON DELETE SET NULL ON UPDATE NO ACTION
- fk_periods_reviewed_by: (reviewed_by) → users(id) ON DELETE SET NULL ON UPDATE NO ACTION
- **Индексы**:
  - idx_periods_country_id: CREATE INDEX idx_periods_country_id ON public.periods USING btree (country_id)
  - idx_periods_created_by: CREATE INDEX idx_periods_created_by ON public.periods USING btree (created_by)
  - idx_periods_draft_saved_at: CREATE INDEX idx_periods_draft_saved_at ON public.periods USING btree (draft_saved_at)
  - idx_periods_end_year: CREATE INDEX idx_periods_end_year ON public.periods USING btree (end_year)
  - idx_periods_is_draft: CREATE INDEX idx_periods_is_draft ON public.periods USING btree (is_draft)
  - idx_periods_period_type: CREATE INDEX idx_periods_period_type ON public.periods USING btree (period_type)
  - idx_periods_person_id: CREATE INDEX idx_periods_person_id ON public.periods USING btree (person_id)
  - idx_periods_start_year: CREATE INDEX idx_periods_start_year ON public.periods USING btree (start_year)
  - idx_periods_status: CREATE INDEX idx_periods_status ON public.periods USING btree (status)
  - idx_periods_submitted_at: CREATE INDEX idx_periods_submitted_at ON public.periods USING btree (submitted_at)
  - idx_periods_type: CREATE INDEX idx_periods_type ON public.periods USING btree (period_type)
  - periods_no_overlap_per_person_type: CREATE INDEX periods_no_overlap_per_person_type ON public.periods USING gist (person_id, period_type, int4range(start_year, end_year))
  - periods_person_type_end_idx: CREATE INDEX periods_person_type_end_idx ON public.periods USING btree (person_id, period_type, end_year)
  - periods_person_type_start_idx: CREATE INDEX periods_person_type_start_idx ON public.periods USING btree (person_id, period_type, start_year)
  - periods_pkey: CREATE UNIQUE INDEX periods_pkey ON public.periods USING btree (id)

### permissions

| Колонка | Тип | NULL | По умолчанию |
|---|---|:--:|---|
| id | integer | NO | nextval('permissions_id_seq'::regclass) |
| name | character varying | NO |  |
| description | text | YES |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

- **Первичный ключ**: id
- **Индексы**:
  - permissions_name_key: CREATE UNIQUE INDEX permissions_name_key ON public.permissions USING btree (name)
  - permissions_pkey: CREATE UNIQUE INDEX permissions_pkey ON public.permissions USING btree (id)

### person_edits

| Колонка | Тип | NULL | По умолчанию |
|---|---|:--:|---|
| id | integer | NO | nextval('person_edits_id_seq'::regclass) |
| person_id | character varying | NO |  |
| proposer_user_id | integer | NO |  |
| payload | jsonb | NO |  |
| status | text | NO | 'pending'::text |
| review_comment | text | YES |  |
| reviewed_by | integer | YES |  |
| created_at | timestamp without time zone | NO | CURRENT_TIMESTAMP |
| reviewed_at | timestamp without time zone | YES |  |

- **Первичный ключ**: id
- **Внешние ключи**:
- person_edits_person_id_fkey: (person_id) → persons(id) ON DELETE CASCADE ON UPDATE NO ACTION
- person_edits_proposer_user_id_fkey: (proposer_user_id) → users(id) ON DELETE CASCADE ON UPDATE NO ACTION
- person_edits_reviewed_by_fkey: (reviewed_by) → users(id) ON DELETE NO ACTION ON UPDATE NO ACTION
- **Индексы**:
  - idx_person_edits_status: CREATE INDEX idx_person_edits_status ON public.person_edits USING btree (status)
  - person_edits_pkey: CREATE UNIQUE INDEX person_edits_pkey ON public.person_edits USING btree (id)

### persons

| Колонка | Тип | NULL | По умолчанию |
|---|---|:--:|---|
| id | character varying | NO |  |
| name | character varying | NO |  |
| birth_year | integer | NO |  |
| death_year | integer | NO |  |
| category | character varying | NO |  |
| description | text | NO |  |
| image_url | character varying | YES |  |
| wiki_link | text | YES |  |
| status | text | NO | 'approved'::text |
| created_by | integer | YES |  |
| updated_by | integer | YES |  |
| submitted_at | timestamp without time zone | YES |  |
| reviewed_at | timestamp without time zone | YES |  |
| reviewed_by | integer | YES |  |
| review_comment | text | YES |  |
| is_draft | boolean | NO | false |
| draft_saved_at | timestamp without time zone | YES |  |
| last_edited_at | timestamp without time zone | YES |  |

- **Первичный ключ**: id
- **Внешние ключи**:
- fk_persons_created_by: (created_by) → users(id) ON DELETE SET NULL ON UPDATE NO ACTION
- fk_persons_reviewed_by: (reviewed_by) → users(id) ON DELETE SET NULL ON UPDATE NO ACTION
- **Индексы**:
  - idx_persons_birth_death_years: CREATE INDEX idx_persons_birth_death_years ON public.persons USING btree (birth_year, death_year)
  - idx_persons_birth_year: CREATE INDEX idx_persons_birth_year ON public.persons USING btree (birth_year)
  - idx_persons_category: CREATE INDEX idx_persons_category ON public.persons USING btree (category)
  - idx_persons_category_trgm: CREATE INDEX idx_persons_category_trgm ON public.persons USING gin (category gin_trgm_ops)
  - idx_persons_created_by: CREATE INDEX idx_persons_created_by ON public.persons USING btree (created_by)
  - idx_persons_death_year: CREATE INDEX idx_persons_death_year ON public.persons USING btree (death_year)
  - idx_persons_description_trgm: CREATE INDEX idx_persons_description_trgm ON public.persons USING gin (description gin_trgm_ops)
  - idx_persons_draft_saved_at: CREATE INDEX idx_persons_draft_saved_at ON public.persons USING btree (draft_saved_at)
  - idx_persons_id: CREATE INDEX idx_persons_id ON public.persons USING btree (id)
  - idx_persons_is_draft: CREATE INDEX idx_persons_is_draft ON public.persons USING btree (is_draft)
  - idx_persons_name_trgm: CREATE INDEX idx_persons_name_trgm ON public.persons USING gin (name gin_trgm_ops)
  - idx_persons_status: CREATE INDEX idx_persons_status ON public.persons USING btree (status)
  - idx_persons_submitted_at: CREATE INDEX idx_persons_submitted_at ON public.persons USING btree (submitted_at)
  - persons_category_idx: CREATE INDEX persons_category_idx ON public.persons USING btree (category)
  - persons_name_trgm: CREATE INDEX persons_name_trgm ON public.persons USING gin (name gin_trgm_ops)
  - persons_pkey: CREATE UNIQUE INDEX persons_pkey ON public.persons USING btree (id)

### role_permissions

| Колонка | Тип | NULL | По умолчанию |
|---|---|:--:|---|
| role_id | integer | NO |  |
| permission_id | integer | NO |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

- **Первичный ключ**: role_id, permission_id
- **Внешние ключи**:
- role_permissions_permission_id_fkey: (permission_id) → permissions(id) ON DELETE CASCADE ON UPDATE NO ACTION
- role_permissions_role_id_fkey: (role_id) → roles(id) ON DELETE CASCADE ON UPDATE NO ACTION
- **Индексы**:
  - role_permissions_pkey: CREATE UNIQUE INDEX role_permissions_pkey ON public.role_permissions USING btree (role_id, permission_id)

### roles

| Колонка | Тип | NULL | По умолчанию |
|---|---|:--:|---|
| id | integer | NO | nextval('roles_id_seq'::regclass) |
| name | character varying | NO |  |
| description | text | YES |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

- **Первичный ключ**: id
- **Индексы**:
  - roles_name_key: CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name)
  - roles_pkey: CREATE UNIQUE INDEX roles_pkey ON public.roles USING btree (id)

### user_sessions

| Колонка | Тип | NULL | По умолчанию |
|---|---|:--:|---|
| id | integer | NO | nextval('user_sessions_id_seq'::regclass) |
| user_id | integer | YES |  |
| token_hash | character varying | NO |  |
| expires_at | timestamp without time zone | NO |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

- **Первичный ключ**: id
- **Внешние ключи**:
- user_sessions_user_id_fkey: (user_id) → users(id) ON DELETE CASCADE ON UPDATE NO ACTION
- **Индексы**:
  - idx_user_sessions_expires: CREATE INDEX idx_user_sessions_expires ON public.user_sessions USING btree (expires_at)
  - idx_user_sessions_token_hash: CREATE INDEX idx_user_sessions_token_hash ON public.user_sessions USING btree (token_hash)
  - idx_user_sessions_user_id: CREATE INDEX idx_user_sessions_user_id ON public.user_sessions USING btree (user_id)
  - user_sessions_pkey: CREATE UNIQUE INDEX user_sessions_pkey ON public.user_sessions USING btree (id)

### users

| Колонка | Тип | NULL | По умолчанию |
|---|---|:--:|---|
| id | integer | NO | nextval('users_id_seq'::regclass) |
| email | character varying | NO |  |
| password_hash | character varying | NO |  |
| username | character varying | YES |  |
| full_name | character varying | YES |  |
| avatar_url | character varying | YES |  |
| role | character varying | YES | 'user'::character varying |
| is_active | boolean | YES | true |
| email_verified | boolean | YES | false |
| email_verification_token | character varying | YES |  |
| password_reset_token | character varying | YES |  |
| password_reset_expires | timestamp without time zone | YES |  |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| email_verification_expires | timestamp without time zone | YES |  |

- **Первичный ключ**: id
- **Индексы**:
  - idx_users_active: CREATE INDEX idx_users_active ON public.users USING btree (is_active)
  - idx_users_email: CREATE INDEX idx_users_email ON public.users USING btree (email)
  - idx_users_email_verif_expires: CREATE INDEX idx_users_email_verif_expires ON public.users USING btree (email_verification_expires)
  - idx_users_role: CREATE INDEX idx_users_role ON public.users USING btree (role)
  - idx_users_username: CREATE INDEX idx_users_username ON public.users USING btree (username)
  - users_email_key: CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email)
  - users_pkey: CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)
  - users_username_key: CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username)


## Представления (Views)

### unique_categories
```sql
SELECT DISTINCT category
   FROM persons
  ORDER BY category;
```

### v_api_persons
```sql
SELECT p.id,
    p.name,
    p.birth_year,
    p.death_year,
    rs.reign_start,
    rs.reign_end,
    p.category,
    (cl.countries)::character varying(100) AS country,
    cl.country_names,
    cl.country_ids,
    p.description,
    p.image_url,
    COALESCE(a.achievements_all, ARRAY[]::text[]) AS achievements,
    a.achievement_years,
    rp.ruler_periods,
    p.wiki_link,
    COALESCE(a.achievements_wiki_all, ARRAY[]::text[]) AS achievements_wiki
   FROM ((((persons p
     LEFT JOIN v_person_achievements_all a ON (((a.person_id)::text = (p.id)::text)))
     LEFT JOIN v_person_ruler_span rs ON (((rs.person_id)::text = (p.id)::text)))
     LEFT JOIN v_person_countries_life cl ON (((cl.person_id)::text = (p.id)::text)))
     LEFT JOIN v_person_ruler_periods rp ON (((rp.person_id)::text = (p.id)::text)));
```

### v_countries
```sql
SELECT id,
    name,
    created_at
   FROM countries;
```

### v_country_stats
```sql
SELECT c.id,
    c.name,
    count(DISTINCT pr.person_id) AS persons_with_periods,
    count(*) FILTER (WHERE ((pr.period_type)::text = 'ruler'::text)) AS ruler_periods,
    count(*) FILTER (WHERE ((pr.period_type)::text = 'life'::text)) AS life_periods
   FROM (countries c
     LEFT JOIN periods pr ON ((pr.country_id = c.id)))
  GROUP BY c.id, c.name;
```

### v_periods_with_names
```sql
SELECT p.id,
    p.person_id,
    p.start_year,
    p.end_year,
    p.period_type,
    p.comment,
    p.country_id,
    c.name AS country_name
   FROM (periods p
     LEFT JOIN countries c ON ((c.id = p.country_id)));
```

### v_person_achievements_all
```sql
SELECT person_id,
    COALESCE(array_remove(array_agg(description ORDER BY year), NULL::text), ARRAY[]::text[]) AS achievements_all,
    COALESCE(array_remove(array_agg(year ORDER BY year), NULL::integer), ARRAY[]::integer[]) AS achievement_years,
    COALESCE(array_remove(array_agg(wikipedia_url ORDER BY year), NULL::text), ARRAY[]::text[]) AS achievements_wiki_all
   FROM achievements a
  GROUP BY person_id;
```

### v_person_countries_life
```sql
SELECT pr.person_id,
    COALESCE(string_agg(DISTINCT c.name, ' / '::text ORDER BY c.name), ''::text) AS countries,
    COALESCE(array_agg(DISTINCT c.name ORDER BY c.name), ARRAY[]::text[]) AS country_names,
    COALESCE(array_agg(DISTINCT c.id ORDER BY c.id), ARRAY[]::integer[]) AS country_ids
   FROM (periods pr
     LEFT JOIN countries c ON ((c.id = pr.country_id)))
  WHERE ((pr.period_type)::text = 'life'::text)
  GROUP BY pr.person_id;
```

### v_person_periods
```sql
SELECT person_id,
    jsonb_agg(jsonb_build_object('id', id, 'start_year', start_year, 'end_year', end_year, 'type', period_type, 'country_id', country_id, 'country_name', country_name, 'comment', comment) ORDER BY start_year) AS periods
   FROM v_periods_with_names
  GROUP BY person_id;
```

### v_person_ruler_periods
```sql
SELECT person_id,
    jsonb_agg(jsonb_build_object('start_year', start_year, 'end_year', end_year, 'country_id', country_id, 'country_name', country_name) ORDER BY start_year) AS ruler_periods
   FROM v_periods_with_names
  WHERE ((period_type)::text = 'ruler'::text)
  GROUP BY person_id;
```

### v_person_ruler_span
```sql
SELECT person_id,
    min(start_year) AS reign_start,
    max(end_year) AS reign_end
   FROM periods
  WHERE ((period_type)::text = 'ruler'::text)
  GROUP BY person_id;
```
