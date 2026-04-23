# Insighta Labs — Intelligence Query Engine

A NestJS + PostgreSQL backend for querying demographic profiles with advanced filtering, sorting, pagination, and natural language search.

---

## Stack

- **Framework:** NestJS (TypeScript)
- **Database:** PostgreSQL via TypeORM
- **UUID:** `uuidv7` (UUID version 7 — time-sortable)
- **Validation:** `class-validator` + `class-transformer`

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and set DATABASE_URL=postgresql://user:password@host:5432/dbname

# 3. Seed the database (place seed-data.json at the project root)
npx ts-node src/seed/run-seed.ts

# 4. Build and start
npm run build
npm start
```

---

## Endpoints

### GET /api/profiles

Returns all profiles with optional filtering, sorting, and pagination.

**Supported query parameters:**

| Parameter | Type | Description |
|---|---|---|
| `gender` | `male` \| `female` | Filter by gender |
| `age_group` | `child` \| `teenager` \| `adult` \| `senior` | Filter by age group |
| `country_id` | `string` | ISO 3166-1 alpha-2 code (e.g. `NG`) |
| `min_age` | `number` | Minimum age (inclusive) |
| `max_age` | `number` | Maximum age (inclusive) |
| `min_gender_probability` | `float 0–1` | Minimum gender confidence score |
| `min_country_probability` | `float 0–1` | Minimum country confidence score |
| `sort_by` | `age` \| `created_at` \| `gender_probability` | Sort field |
| `order` | `asc` \| `desc` | Sort direction |
| `page` | `number` (default: 1) | Page number |
| `limit` | `number` (default: 10, max: 50) | Items per page |

All filters are combinable — every condition passed must match.

**Example:**
```
GET /api/profiles?gender=male&country_id=NG&min_age=25&sort_by=age&order=desc&page=1&limit=10
```

---

### GET /api/profiles/search

Natural language query endpoint.

```
GET /api/profiles/search?q=young males from nigeria
GET /api/profiles/search?q=adult females above 30 from kenya&page=1&limit=20
```

---

## Natural Language Parsing Approach

The parser is **100% rule-based**. No AI, no LLMs, no external APIs.

### How it works

The raw query string is lowercased, then matched against a series of regex patterns in sequence. Each match writes into a `filters` object that is then passed to the same query engine used by `GET /api/profiles`.

### Supported Keywords and Their Mappings

#### Gender

| Input | Maps to |
|---|---|
| `male`, `males`, `man`, `men`, `boy`, `boys` | `gender = male` |
| `female`, `females`, `woman`, `women`, `girl`, `girls` | `gender = female` |
| Both present (e.g. `male and female`) | No gender filter (shows all) |

#### Age Groups

| Input | Maps to |
|---|---|
| `child`, `children`, `kids` | `age_group = child` |
| `teenager`, `teenagers`, `teen`, `teens` | `age_group = teenager` |
| `adult`, `adults` | `age_group = adult` |
| `senior`, `seniors`, `elderly`, `old people` | `age_group = senior` |

#### "Young" — Special Case

`young` is **not** a stored age group. Per the spec, it maps to:
- `min_age = 16`
- `max_age = 24`

This only applies when no other age group keyword is present.

#### Explicit Age Ranges

| Pattern | Maps to |
|---|---|
| `above 30`, `over 30`, `older than 30`, `at least 30` | `min_age = 30` |
| `below 25`, `under 25`, `younger than 25`, `at most 25` | `max_age = 25` |
| `between 20 and 35`, `between 20 to 35` | `min_age = 20`, `max_age = 35` |

#### Country Detection

The parser looks for phrases like:
- `from nigeria` → `country_id = NG`
- `in kenya` → `country_id = KE`
- `living in angola` → `country_id = AO`
- `based in ghana` → `country_id = GH`

Country names are resolved against a lookup map of ~80+ countries. If no `from/in` phrase is found, it falls back to scanning the whole query for any known country name.

### Example Query Mappings

| Query | Parsed Filters |
|---|---|
| `young males` | `gender=male`, `min_age=16`, `max_age=24` |
| `females above 30` | `gender=female`, `min_age=30` |
| `people from angola` | `country_id=AO` |
| `adult males from kenya` | `gender=male`, `age_group=adult`, `country_id=KE` |
| `male and female teenagers above 17` | `age_group=teenager`, `min_age=17` |
| `senior women in nigeria` | `gender=female`, `age_group=senior`, `country_id=NG` |
| `children under 10` | `age_group=child`, `max_age=10` |

### Uninterpretable Queries

If no filter can be extracted from the query, the response is:
```json
{ "status": "error", "message": "Unable to interpret query" }
```

---

## Limitations

### Parser Limitations

1. **No negation support** — "not from Nigeria" or "excluding males" will not be parsed correctly. The `not/excluding/except` keywords are ignored.

2. **Ambiguous `young` + age group** — If both `young` and an age group word (e.g. `young adults`) appear, the age group takes priority and the `young` (16–24 range) is not applied.

3. **Multi-country queries** — "from Nigeria or Ghana" only picks up the first matched country. `OR` logic between countries is not supported.

4. **Adjective stacking** — Phrases like "highly confident female adults" won't extract the probability filter. `min_gender_probability` and `min_country_probability` cannot be set via natural language.

5. **Relative age language** — Terms like "middle-aged", "elderly" (partially handled as `senior`), "very young", or "late teens" may not map correctly.

6. **Non-English input** — The parser only handles English queries. French, Yoruba, Swahili, etc. are not supported.

7. **Typos and misspellings** — The parser does exact/substring matching. "Nigaria" or "femael" will not be recognized.

8. **City-level queries** — "from Lagos" or "from Nairobi" won't work; only country-level is supported.

9. **Compound country names without hyphens** — "guinea bissau" vs "guinea-bissau" — both are handled, but unusual spellings may be missed.

10. **`sort_by` and `order` via NLP** — Natural language cannot specify sorting. The default sort (`created_at asc`) is always applied in `/search`.

---

## Error Response Format

All errors follow this structure:

```json
{ "status": "error", "message": "<description>" }
```

| Scenario | HTTP Status | Message |
|---|---|---|
| Missing `q` param | 200 | `Missing or empty parameter` |
| Uninterpretable query | 200 | `Unable to interpret query` |
| Invalid filter values | 200 | `Invalid query parameters` |
| Server error | 500 | `Server error` |

---

## Database Schema

```sql
CREATE TABLE profiles (
  id                  UUID PRIMARY KEY,
  name                VARCHAR UNIQUE NOT NULL,
  gender              VARCHAR NOT NULL,
  gender_probability  FLOAT NOT NULL,
  age                 INT NOT NULL,
  age_group           VARCHAR NOT NULL,
  country_id          VARCHAR(2) NOT NULL,
  country_name        VARCHAR NOT NULL,
  country_probability FLOAT NOT NULL,
  created_at          TIMESTAMP DEFAULT NOW()
);

-- Indexes for filtered queries
CREATE INDEX ON profiles (gender);
CREATE INDEX ON profiles (age);
CREATE INDEX ON profiles (age_group);
CREATE INDEX ON profiles (country_id);
```

---

