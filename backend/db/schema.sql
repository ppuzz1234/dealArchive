-- ============================================================
-- DealArchive — Postgres 스키마 (로컬: PGlite 내장 / 운영: Supabase Postgres 공용)
-- idempotent: 서버 기동 시·`npm run db:setup` 시 반복 실행해도 안전하다.
-- 분류(category/subcategory)·지표·등급 정의는 backend/src/taxonomy.js 가 기준.
-- ============================================================

-- 담당자 — 현재는 로그인 없이 이름 선택으로 사용(향후 SSO 연동 시 auth 테이블 추가)
create table if not exists users (
  id          serial primary key,
  name        text not null unique,
  team        text,
  created_at  timestamptz not null default now()
);

-- 딜 — 아카이브(archived)와 신규 심사(review)를 같은 테이블에서 status로 구분
create table if not exists deals (
  id              serial primary key,
  no              integer,                         -- 시트 원본 번호(신규 딜은 null)
  name            text not null,
  summary         text,                            -- 상품 설명
  structure       text,                            -- 구조·수익원 (신규 온보딩 양식)
  cases           text,                            -- 국내외 사례
  risks           text,                            -- 리스크·검토사항
  category        text not null,
  subcategory     text,
  region          text,
  vehicle         text,                            -- 비히클
  sourcing_model  text,                            -- 소싱 모델 (잡화점/Original 등)
  target_return   text,                            -- 기대수익률
  horizon         text,                            -- 투자기간·만기
  liquidity_terms text,                            -- 환매·유동성 조건
  min_ticket      text,                            -- 최소 투자금액
  grade_reason    text,                            -- 순위 선정 사유
  next_action     text,                            -- 검토 필요 사항
  tags            text[] not null default '{}',
  metrics         jsonb not null default '{}',     -- {return, stability, liquidity, feasibility, appeal, synergy}: 1~5
  metrics_estimated boolean not null default false,-- 초기 추정치 여부(담당자가 수정하면 false)
  status          text not null default 'review',  -- review | archived
  owner_id        integer references users(id),
  review_date     date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_deals_category on deals(category, subcategory);
create index if not exists idx_deals_status on deals(status);

-- 투표 — 1인 1표(수정 가능), 등급은 A / B+ / B / C
create table if not exists votes (
  id          serial primary key,
  deal_id     integer not null references deals(id) on delete cascade,
  user_id     integer not null references users(id),
  grade       text not null check (grade in ('A','B+','B','C')),
  comment     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (deal_id, user_id)
);

-- Q&A — 누구나 질문, 딜 담당자가 답변
create table if not exists questions (
  id          serial primary key,
  deal_id     integer not null references deals(id) on delete cascade,
  user_id     integer not null references users(id),
  body        text not null,
  created_at  timestamptz not null default now()
);
create table if not exists answers (
  id          serial primary key,
  question_id integer not null references questions(id) on delete cascade,
  user_id     integer not null references users(id),
  body        text not null,
  created_at  timestamptz not null default now()
);

-- 첨부파일 — 소규모 팀 사용 기준으로 DB(bytea)에 보관(별도 스토리지 불필요)
create table if not exists attachments (
  id          serial primary key,
  deal_id     integer not null references deals(id) on delete cascade,
  user_id     integer references users(id),
  filename    text not null,
  mime        text,
  size        integer not null,
  data        bytea not null,
  created_at  timestamptz not null default now()
);

-- 글로벌 딜·시장 피드 — 담당자 수동 등록
create table if not exists market_items (
  id           serial primary key,
  title        text not null,
  url          text,
  source       text,
  region       text,
  category     text,
  summary      text,
  published_on date,
  deal_id      integer references deals(id) on delete set null,
  user_id      integer references users(id),
  created_at   timestamptz not null default now()
);
