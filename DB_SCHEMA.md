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

- **Первичный ключ**: id
- **Внешние ключи**:
- fk_achievements_person: (person_id) → persons(id) ON DELETE SET NULL ON UPDATE NO ACTION
- **Индексы**:
  - achievements_pkey: CREATE UNIQUE INDEX achievements_pkey ON public.achievements USING btree (id)
  - idx_achievements_person_id: CREATE INDEX idx_achievements_person_id ON public.achievements USING btree (person_id)
  - idx_achievements_year: CREATE INDEX idx_achievements_year ON public.achievements USING btree (year)

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

- **Первичный ключ**: id
- **Внешние ключи**:
- fk_periods_country: (country_id) → countries(id) ON DELETE SET NULL ON UPDATE NO ACTION
- fk_periods_person: (person_id) → persons(id) ON DELETE SET NULL ON UPDATE NO ACTION
- **Индексы**:
  - idx_periods_country_id: CREATE INDEX idx_periods_country_id ON public.periods USING btree (country_id)
  - idx_periods_end_year: CREATE INDEX idx_periods_end_year ON public.periods USING btree (end_year)
  - idx_periods_person_id: CREATE INDEX idx_periods_person_id ON public.periods USING btree (person_id)
  - idx_periods_start_year: CREATE INDEX idx_periods_start_year ON public.periods USING btree (start_year)
  - idx_periods_type: CREATE INDEX idx_periods_type ON public.periods USING btree (period_type)
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

### persons

| Колонка | Тип | NULL | По умолчанию |
|---|---|:--:|---|
| id | character varying | NO |  |
| name | character varying | NO |  |
| birth_year | integer | NO |  |
| death_year | integer | NO |  |
| category | character varying | NO |  |
| country | character varying | NO |  |
| description | text | NO |  |
| image_url | character varying | YES |  |

- **Первичный ключ**: id
- **Индексы**:
  - idx_persons_birth_death_years: CREATE INDEX idx_persons_birth_death_years ON public.persons USING btree (birth_year, death_year)
  - idx_persons_birth_year: CREATE INDEX idx_persons_birth_year ON public.persons USING btree (birth_year)
  - idx_persons_category: CREATE INDEX idx_persons_category ON public.persons USING btree (category)
  - idx_persons_country: CREATE INDEX idx_persons_country ON public.persons USING btree (country)
  - idx_persons_death_year: CREATE INDEX idx_persons_death_year ON public.persons USING btree (death_year)
  - idx_persons_id: CREATE INDEX idx_persons_id ON public.persons USING btree (id)
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

### unique_countries
```sql
SELECT DISTINCT country
   FROM persons
  ORDER BY country;
```

### v_achievements_top3
```sql
SELECT person_id,
    (array_agg(description ORDER BY year))[1:3] AS achievements_top3,
    (array_agg(year ORDER BY year))[1] AS achievement_year_1,
    (array_agg(year ORDER BY year))[2] AS achievement_year_2,
    (array_agg(year ORDER BY year))[3] AS achievement_year_3
   FROM achievements a
  GROUP BY person_id;
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
    p.description,
    p.image_url,
    COALESCE(a.achievements_top3, ARRAY[]::text[]) AS achievements,
    a.achievement_year_1,
    a.achievement_year_2,
    a.achievement_year_3,
    rp.ruler_periods
   FROM ((((persons p
     LEFT JOIN v_achievements_top3 a ON (((a.person_id)::text = (p.id)::text)))
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

### v_person_countries_life
```sql
SELECT person_id,
    string_agg(DISTINCT country_name, '/'::text ORDER BY country_name) AS countries
   FROM v_periods_with_names
  WHERE (((period_type)::text = 'life'::text) AND (country_name IS NOT NULL))
  GROUP BY person_id;
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
