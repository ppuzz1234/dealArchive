# DealArchive

PLUS 소싱 매트릭스(Google Sheet)로 관리하던 딜 리스트를 **BI형 아카이브 + 신규 딜 심사(투표·Q&A) + 글로벌 딜 피드**로 옮긴 사내 도구입니다.

React(Vite) 프론트엔드 + Node.js(Express) API 모노레포. DB는 로컬에서는 설치 없이 동작하는 내장 Postgres(PGlite),
운영에서는 Supabase Postgres를 같은 SQL로 사용합니다.

## 기능

| 메뉴 | 내용 |
|------|------|
| **대시보드** | KPI · 분류별 딜 맵(트리맵, 면적=딜 수/색=합의 등급) · 분류별 등급 분포 · 분류×6대 지표 히트맵 · 지역/담당자별 · 상위 평가 딜 · 최근 활동. 모든 차트는 클릭 드릴다운 · hover 툴팁 · '표로 보기' 지원 |
| **딜 아카이브** | 대분류 › 소분류 › 개별 딜 드릴다운(분류 트리 + 트리맵), 검색·등급·지역·담당자·상태 필터, 카드/표 보기. 필터 상태는 URL에 남아 링크로 공유 가능 |
| **딜 상세** | 상품 설명 · 국내외 사례 · 리스크 · 핵심 조건, **육각형 6대 지표**(같은 분류 평균과 비교), **등급 투표**(A/B+/B/C, 1인 1표), **Q&A**(누구나 질문 → 딜 담당자 답변), 첨부파일, **유사 딜** 추천 |
| **딜 등록** | 이력서처럼 정해진 항목(기본 정보 → 개요 → 사례·조건 → 리스크 → 평가 → 첨부)을 채우면 구조화 데이터로 저장. 등록 시 '심사중' 상태 |
| **심사 보드** | 심사중 딜의 투표 진행률 · 합의 등급 · 내 투표 대기 · 내 딜의 미답변 질문 |
| **글로벌 딜 피드** | 해외 딜·대체투자·금융 사례를 링크·요약으로 스크랩하고 아카이브 딜과 연결 (자동 수집은 추후) |
| **관리자 · 일정** | 달력에서 딜소싱 마감일 · 심사일을 지정/수정/취소. 사이드바에 다가오는 일정과 D-day 표시. 딜소싱 마감 D-1·당일에 이번 회차(직전 마감일 다음 날~이번 마감일) 딜을 올리지 않은 담당자에게는 대시보드 배너와 '딜 등록' 메뉴 강조로 등록을 독려 |
| **담당자** | 로그인 없이 이름을 골라 사용(오른쪽 위). 권한·SSO는 이후 단계 |

### 데이터 기준
- **분류 체계·6대 지표·등급 정의**: [backend/src/taxonomy.js](backend/src/taxonomy.js) — 대분류/소분류 추가는 이 파일만 수정
- **6대 지표**: 기대수익 · 안정성 · 유동성 · 실행가능성 · 고객매력도 · 그룹 시너지 (1~5점)
- **등급**: 시트의 '우선순위'와 동일한 A / B+ / B / C. 합의 등급 = 투표 평균(A=4, B+=3, B=2, C=1)을 가장 가까운 등급으로 환산
- **초기 데이터**: 시트 34건 이관 — [backend/db/seed-data.js](backend/db/seed-data.js). 시트의 우선순위는 담당자 본인의 투표로 이관(TBD는 미투표).
  6대 지표는 시트 내용을 근거로 한 **초기 추정치**이며 화면에 '추정치' 배지가 붙고, 담당자가 편집하면 확정값이 됩니다.
- **담당자 등급 비공개**: 딜 담당자 본인의 등급(A/B+/B/C)은 **다른 담당자 3명 이상이 투표**하기 전까지 담당자 본인에게만 보이고,
  다른 사람에게는 '?'로 표시됩니다(API가 값 자체를 내려보내지 않음). 6대 지표 육각형은 항상 공개됩니다. 그동안 합의 등급·투표 수는 담당자 표를 뺀 값입니다. 기준 인원은 [backend/src/lib/visibility.js](backend/src/lib/visibility.js)
- **유사 딜**: 같은 소분류/대분류 + 6대 지표 거리 + 지역 + 비히클 가중합 ([backend/src/lib/similarity.js](backend/src/lib/similarity.js))

## 빠른 시작

```bash
npm install
npm run dev
#   프론트: http://localhost:4699
#   API:    http://localhost:4700/api/health
```

`DATABASE_URL`이 비어 있으면 `backend/.data/pglite`에 내장 DB가 만들어지고, 처음 기동할 때 시트 34건이 자동으로 시드됩니다.

```bash
npm run db:setup -w backend   # 스키마만 적용
npm run db:seed  -w backend   # 스키마 + (비어 있으면) 시드
npm run db:reset -w backend   # 전체 삭제 후 재시드 (주의: 데이터 삭제, API 서버를 먼저 끌 것)
```

## 구조

```
DealArchive/
├── frontend/src/
│   ├── App.jsx · context.jsx · api.js · lib.js · styles.css
│   ├── components/   Shell(사이드바·담당자 선택) · charts(트리맵·레이더·누적바·히트맵) · ui
│   └── screens/      Dashboard · Explorer · DealDetail · DealForm · Review · Feed · People
└── backend/
    ├── db/           schema.sql · seed-data.js · setup.js
    └── src/          index.js · db.js(pg/PGlite) · bootstrap.js · taxonomy.js · routes/ · lib/
```

## API

| 메서드 | 엔드포인트 | 용도 |
|--------|-----------|------|
| GET | `/api/meta` | 분류 체계 · 지표 · 등급 · 지역 |
| GET/POST | `/api/users` | 담당자 목록 / 추가 |
| GET/POST | `/api/deals` | 딜 목록(투표 집계 포함) / 신규 등록 |
| GET/PUT/DELETE | `/api/deals/:id` | 상세(투표·Q&A·첨부·유사 딜) / 수정 / 삭제(담당자만) |
| PUT/DELETE | `/api/deals/:id/vote` | 등급 투표 / 취소 |
| POST | `/api/deals/:id/questions` · `/api/questions/:qid/answers` | 질문 / 답변(딜 담당자만) |
| POST · GET · DELETE | `/api/deals/:id/attachments` · `/api/attachments/:aid` | 첨부 업로드(15MB) / 다운로드 / 삭제 |
| GET | `/api/activity` | 최근 활동 |
| GET/POST/PUT/DELETE | `/api/schedule` | 일정(딜소싱 마감일 · 심사일) — 마감일별 등록 완료 담당자 포함 |
| GET/POST/PUT/DELETE | `/api/feed` | 글로벌 딜 피드 |

쓰기 요청은 `X-User-Id` 헤더(화면에서 고른 담당자)를 사용합니다. 로그인 도입 시 이 부분을 세션으로 교체합니다.

## 배포

- 백엔드: `main` push → GitHub Actions가 이미지 빌드(ghcr.io) → NAS Watchtower 자동 교체 ([deploy/nas/README.md](deploy/nas/README.md))
- 운영 DB: `backend.env`의 `DATABASE_URL`에 Supabase 연결 문자열 지정. 기동 시 스키마가 자동 적용되고, 딜 테이블이 비어 있으면 시드됩니다.
  (운영에서 `DATABASE_URL`을 비우면 컨테이너 내부 PGlite를 쓰므로 컨테이너 교체 시 데이터가 사라집니다)
- 프론트: `npm run build` → `frontend/dist`. API가 다른 도메인이면 빌드 시 `VITE_API_BASE=https://api.도메인/api` 지정,
  백엔드 `CORS_ORIGIN`에 프론트 도메인을 넣습니다(쉼표로 여러 개).
