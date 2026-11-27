-- ============================================================
-- PLUS Barbell — Postgres 스키마 설계 (2차, 2026-07-09 의사결정 반영)
-- 호스팅: Supabase 확정 (호스팅 Postgres로만 사용 — Auth/클라이언트 SDK 미사용, API는 자체 backend).
--         표준 Postgres DDL 유지로 이식성 보존.
-- 금액: 모든 금액 컬럼은 원 단위 bigint (*_krw). 프론트 표기 단위(억/만원) 환산은
--       백엔드(src/lib/money.js)에서 수행한다.
-- 재실행: 이 파일은 idempotent — `npm run db:setup`을 반복 실행해도 에러 없이 통과한다.
--         (단, 이미 존재하는 테이블의 컬럼 변경은 반영되지 않음 — 컬럼 변경은 별도 migration 필요)
--
-- 설계 원칙
--   1) UserMaster가 모든 사용자(카카오/네이버/구글/휴대폰)의 단일 기준(SSOT).
--      로그인 수단이 늘어나거나(카카오/구글 실연동 전환 등) 사용자가 계정을 여러 provider로
--      연결해도 auth_identity만 늘어나고 user_master.id는 바뀌지 않는다.
--   2) "유저 = LP" 가정을 깨고, role을 유저와 분리된 배열형 관계로 둔다.
--      한 사람이 지금은 개인 LP만이지만 나중에 GP 권한을 추가로 받는 것까지 스키마 변경 없이 수용.
--   3) LP-Deal, GP-Deal 관계 모두 "1 유저 : N 딜" 대응이 양쪽에서 성립하는 대칭 구조로 둔다.
--      즉 각각 junction 테이블(deal_gp / holding)을 통해 표현하며, 어느 한쪽도 단일 FK로
--      고정하지 않는다 — 한 GP가 여러 딜을 올리는 것은 물론, 한 딜을 여러 GP가 공동 운용하는
--      것도(컨소시엄 딜) 스키마 변경 없이 수용 가능.
--   4) 회사(company)와 딜(deal)을 분리한다. 기업가치·카탈리스트는 회사의 속성이고,
--      한 회사에 여러 딜(1차 SPV, 2차 SPV, 펀드 편입)이 붙거나 딜 없는 회사를
--      기업검색으로 등록해 진단만 하는 경우(프론트 registerCompany)를 모두 수용.
-- ============================================================

create extension if not exists pgcrypto; -- gen_random_uuid()

-- ---------- 공통: updated_at 자동 갱신 ----------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- 1. UserMaster — 모든 사용자의 기준 테이블
--    게스트(둘러보기)는 DB에 만들지 않는다 — 클라이언트 상태로만 존재하고,
--    회원가입/로그인 시점에 비로소 user_master 행이 생성된다.
-- ============================================================
do $$ begin
  create type user_status as enum ('active', 'suspended', 'withdrawn');
exception when duplicate_object then null; end $$;

create table if not exists user_master (
  id           uuid primary key default gen_random_uuid(),
  status       user_status not null default 'active',
  display_name text,                 -- 화면에 보여줄 이름(최초 가입 provider의 name/nickname으로 초기화)
  phone        text unique,          -- 휴대폰 로그인/본인인증 번호 (정규화된 E.164)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists trg_user_master_updated_at on user_master;
create trigger trg_user_master_updated_at
  before update on user_master
  for each row execute function set_updated_at();

-- ============================================================
-- 2. AuthIdentity — 소셜/휴대폰 로그인 수단 (유저 1명에 여러 개 연결 가능)
--    naver.js/auth.js가 실제로 돌려주는 profile 필드(id/name/email/nickname/profileImage)를 그대로 매핑.
--    provider_uid 키 규칙: 소셜 = provider가 주는 회원번호, phone = E.164 전화번호(+8210...).
-- ============================================================
do $$ begin
  create type auth_provider as enum ('kakao', 'naver', 'google', 'phone');
exception when duplicate_object then null; end $$;

create table if not exists auth_identity (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references user_master(id) on delete cascade,
  provider          auth_provider not null,
  provider_uid      text not null,
  email             text,
  nickname          text,
  profile_image_url text,
  raw_profile       jsonb,                  -- provider 원본 응답 보관 (디버깅/추후 필드 추가 대비)
  created_at        timestamptz not null default now(),
  unique (provider, provider_uid)
);
create index if not exists idx_auth_identity_user_id on auth_identity(user_id);

-- ============================================================
-- 3. UserRole — 유저의 역할(복수 가능). LP 개인/법인, GP, 운영자 등.
--    현재 프론트 userType 상태값("hnw" | "institution" | "manager")과 대응.
-- ============================================================
do $$ begin
  create type user_role_type as enum ('lp_individual', 'lp_institution', 'gp', 'admin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type role_status as enum ('pending', 'active', 'suspended');
exception when duplicate_object then null; end $$;

create table if not exists user_role (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references user_master(id) on delete cascade,
  role       user_role_type not null,
  status     role_status not null default 'active',
  granted_at timestamptz not null default now(),
  unique (user_id, role)
);
create index if not exists idx_user_role_user_id on user_role(user_id);

-- ============================================================
-- 4. LpQualifiedInvestor — 개인 LP 전문투자자 자격 심사
--    HnwAbout 화면의 필수요건(잔고) + 선택요건(순재산/소득/전문자격증 중 택1) 구조를 그대로 반영.
-- ============================================================
do $$ begin
  create type lp_optional_requirement as enum ('net_worth', 'income', 'professional_cert');
exception when duplicate_object then null; end $$;
do $$ begin
  create type qualification_status as enum ('unverified', 'pending', 'qualified', 'rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type verification_method as enum ('linked_account', 'mydata', 'consult_upload');
exception when duplicate_object then null; end $$;

create table if not exists lp_qualified_investor (
  user_id                  uuid primary key references user_master(id) on delete cascade,
  status                   qualification_status not null default 'unverified',
  verification_method      verification_method,

  -- 필수요건: 최근 5년 중 1년 이상 금융투자상품 잔고 5천만원 이상
  required_balance_met     boolean not null default false,
  required_balance_krw     bigint,          -- 확인된 최고 잔고
  required_balance_checked_at timestamptz,

  -- 선택요건(1~3 중 택일)
  optional_requirement     lp_optional_requirement,
  net_worth_krw            bigint,          -- 부부합산 순재산 (거주 부동산 제외)
  income_krw               bigint,          -- 소득 (부부합산 시 1.5억 기준)
  professional_cert_type   text,            -- 공인회계사/감정평가사/변호사 등

  qualified_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
drop trigger if exists trg_lp_qualified_investor_updated_at on lp_qualified_investor;
create trigger trg_lp_qualified_investor_updated_at
  before update on lp_qualified_investor
  for each row execute function set_updated_at();

-- ============================================================
-- 5. GpProfile — 운용사(GP) 프로필
-- ============================================================
do $$ begin
  create type gp_status as enum ('pending', 'approved', 'suspended');
exception when duplicate_object then null; end $$;

create table if not exists gp_profile (
  user_id         uuid primary key references user_master(id) on delete cascade,
  firm_name       text not null,
  business_reg_no text,             -- 사업자등록번호
  license_no      text,             -- 금융투자업 등록번호
  status          gp_status not null default 'pending',
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists trg_gp_profile_updated_at on gp_profile;
create trigger trg_gp_profile_updated_at
  before update on gp_profile
  for each row execute function set_updated_at();

-- ============================================================
-- 6. Company — 투자 대상 회사. 기업가치·산업 태그·카탈리스트의 귀속처.
--    sector는 딜 필터의 기준이 되는 산업 태그 — 유저의 관심 산업 선택(sectorInterest)은
--    필터용 클라이언트 상태로만 쓰고 DB에 영속화하지 않는다.
-- ============================================================
create table if not exists company (
  id              uuid primary key default gen_random_uuid(),
  slug            text,             -- 프론트 data.js 식별자 매핑 (예: "anthropic")
  name            text not null,
  sector          text,
  tag             text,
  description     text,
  valuation_krw   bigint,           -- 최근 확정 라운드 기업가치
  valuation_band_low_krw  bigint,   -- 진행중 라운드 밴드 (있는 경우)
  valuation_band_high_krw bigint,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- 기존 DB 마이그레이션 (2026-07-10, 프론트 목데이터 ↔ DB 매핑용 slug)
alter table company add column if not exists slug text;
create unique index if not exists idx_company_slug on company(slug);
drop trigger if exists trg_company_updated_at on company;
create trigger trg_company_updated_at
  before update on company
  for each row execute function set_updated_at();

-- ============================================================
-- 7. Deal — GP가 등록/판매하는 상품 (단일종목 SPV 또는 펀드). 회사 정보는 company 참조.
-- ============================================================
do $$ begin
  create type deal_structure_type as enum ('spv_single', 'fund');
exception when duplicate_object then null; end $$;
do $$ begin
  create type deal_status as enum ('draft', 'open', 'closed', 'exited');
exception when duplicate_object then null; end $$;

create table if not exists deal (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company(id),
  slug            text,             -- 프론트 data.js hnwDeals[].id 매핑 (예: "anthropic")
  structure_type  deal_structure_type not null,
  name            text not null,    -- 딜 자체의 명칭 (예: "OO 1차 SPV")
  round_label     text,             -- 펀드레이징 라운드 (예: "Series F") — 같은 회사 재투자 시 라운드 구분
  round_valuation_krw bigint,       -- 이 라운드의 확정 기업가치. 평가수익 = holding.amount × (company.valuation ÷ 이 값)
  closed_at       timestamptz,      -- 라운드(모집) 종료 시점
  min_invest_krw  bigint not null,
  target_amount_krw bigint,
  filled_pct      numeric(5,2) default 0,  -- 모집률 저장 컬럼 (데모 단계 결정) — 실청약 흐름 도입 시 commitment 합산 계산으로 전환
  status          deal_status not null default 'draft',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- 기존 DB 마이그레이션 (2026-07-10, 포트폴리오 라운드 관리): 이미 생성된 deal 테이블에 컬럼만 추가 — 기존 데이터 보존
alter table deal add column if not exists round_label text;
alter table deal add column if not exists round_valuation_krw bigint;
alter table deal add column if not exists closed_at timestamptz;
alter table deal add column if not exists slug text;
create unique index if not exists idx_deal_slug on deal(slug);
create index if not exists idx_deal_company_id on deal(company_id);
drop trigger if exists trg_deal_updated_at on deal;
create trigger trg_deal_updated_at
  before update on deal
  for each row execute function set_updated_at();

-- ---------- DealGp — GP ↔ Deal (다대다). 한 딜을 여러 GP가 공동 운용할 수 있게 junction으로 분리 ----------
create table if not exists deal_gp (
  deal_id    uuid not null references deal(id) on delete cascade,
  gp_user_id uuid not null references user_master(id),
  created_at timestamptz not null default now(),
  primary key (deal_id, gp_user_id)
);
create index if not exists idx_deal_gp_gp_user_id on deal_gp(gp_user_id);

-- ============================================================
-- 8. CompanyCatalyst — 회사별 뉴스/카탈리스트 (호재/악재). 종목 상세 화면의 카탈리스트 리스트에 대응.
--    뉴스는 특정 딜이 아니라 회사에 대한 것이므로 company에 귀속 — 같은 회사의 여러 딜이 공유.
-- ============================================================
do $$ begin
  create type catalyst_tone as enum ('up', 'down');
exception when duplicate_object then null; end $$;

create table if not exists company_catalyst (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references company(id) on delete cascade,
  tone         catalyst_tone not null,
  tag          text,
  impact       text,             -- 상/중/하
  title        text not null,
  source       text,
  published_at date,
  ai_summary   jsonb,            -- 3줄 요약 (text[] 대신 jsonb로 유연하게)
  impact_note  text,             -- "영향 경로" 한 줄
  created_at   timestamptz not null default now()
);
create index if not exists idx_company_catalyst_company_id on company_catalyst(company_id);

-- 카탈리스트 간 "반대 신호" 참조 (counterIds) — 자기참조 다대다
create table if not exists company_catalyst_counter (
  catalyst_id         uuid not null references company_catalyst(id) on delete cascade,
  counter_catalyst_id uuid not null references company_catalyst(id) on delete cascade,
  primary key (catalyst_id, counter_catalyst_id)
);

-- ============================================================
-- 9. Commitment — LP의 청약/관심 표명 (체결 전 단계, AppContext의 commits 상태에 대응)
--    프론트는 억 단위로 입력받지만 저장은 원 단위 — 환산은 백엔드에서.
-- ============================================================
do $$ begin
  create type commitment_status as enum ('interested', 'committed', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists commitment (
  id          uuid primary key default gen_random_uuid(),
  lp_user_id  uuid not null references user_master(id),
  deal_id     uuid not null references deal(id),
  amount_krw  bigint not null,
  status      commitment_status not null default 'interested',
  created_at  timestamptz not null default now()
);
create index if not exists idx_commitment_lp_user_id on commitment(lp_user_id);
create index if not exists idx_commitment_deal_id on commitment(deal_id);

-- ============================================================
-- 10. UserVehicle — 유저 수준의 투자기구(신탁/LLC) 개설 상태.
--     프론트 vehicle {trust, llc} 상태의 영속화 — 행이 존재하면 "개설 완료"로,
--     재로그인 시 개설 단계를 건너뛰는 데 사용. 건별 체결 기구는 holding.vehicle에 별도 기록.
-- ============================================================
do $$ begin
  create type holding_vehicle as enum ('trust', 'llc');
exception when duplicate_object then null; end $$;

create table if not exists user_vehicle (
  user_id    uuid not null references user_master(id) on delete cascade,
  vehicle    holding_vehicle not null,
  opened_at  timestamptz not null default now(),
  primary key (user_id, vehicle)
);

-- ============================================================
-- 11. Holding — 실제 체결된 보유 포지션. LP ↔ GP를 Deal을 통해 잇는 핵심 테이블.
-- ============================================================
do $$ begin
  create type holding_status as enum ('active', 'exit_requested', 'exited');
exception when duplicate_object then null; end $$;

create table if not exists holding (
  id           uuid primary key default gen_random_uuid(),
  lp_user_id   uuid not null references user_master(id),
  deal_id      uuid not null references deal(id),
  amount_krw   bigint not null,       -- 투자원금, 원 단위 (프론트 만원 단위 입력은 백엔드에서 환산)
  vehicle      holding_vehicle,       -- 이 건이 체결된 기구 (유저의 개설 상태는 user_vehicle)
  status       holding_status not null default 'active',
  invested_at  timestamptz not null default now(),
  exited_at    timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_holding_lp_user_id on holding(lp_user_id);
create index if not exists idx_holding_deal_id on holding(deal_id);
