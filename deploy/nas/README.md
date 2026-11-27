# 시놀로지 NAS 백엔드 배포 가이드

구성: NAS의 Docker에서 백엔드 컨테이너 실행 + Cloudflare Tunnel로 외부 연결
(포트포워딩·DDNS 불필요, 집 IP 비노출)

```
[배포]  main push → GitHub Actions 빌드 → ghcr.io 이미지 업로드
                                              └→ NAS Watchtower가 자동 감지·교체 (커밋 후 ~5분 내 반영)
[운영]  사용자 → Cloudflare Pages (프론트)
                   └─ api.도메인.com → Cloudflare Tunnel → NAS: backend(4700) → Supabase
```

NAS에는 소스코드가 필요 없다 — 완성된 이미지만 내려받아 실행한다.

## 0. 사전 준비
- DSM Docker 패키지 설치됨
- DSM 제어판 → 터미널 및 SNMP → **SSH 서비스 활성화**
- Cloudflare에 도메인 연결돼 있을 것
- GitHub 리포에 이 폴더가 커밋·push돼 있을 것 (Actions 워크플로우 활성화)

## 1. 파일 올리기
File Station으로 `deploy/nas/` 폴더의 파일만 NAS에 복사 (예: `/volume1/docker/dealarchive/`)
- `docker-compose.yml`, `backend.env.example` 두 개면 충분

## 2. 환경변수 작성
`backend.env.example` → 같은 위치에 `backend.env` 로 복사 후 실제 값 입력.
- DATABASE_URL에 Supabase 연결 문자열, CORS_ORIGIN에 프론트 도메인 입력 (로그인/OAuth 설정은 현재 없음)

## 3. 이미지 저장소(ghcr) 접근 설정
### 3-1. GitHub 토큰 발급
GitHub → Settings → Developer settings → Personal access tokens (classic)
→ `read:packages` 권한만 체크해 발급

### 3-2. NAS에서 로그인 (SSH)
```sh
ssh 관리자계정@NAS주소
sudo docker login ghcr.io -u ppuzz1234   # 비밀번호 자리에 위 토큰 입력
```
(이 로그인 정보를 Watchtower도 공유해 새 이미지를 받아온다)

## 4. Cloudflare Tunnel 생성
(2025~ Cloudflare One UI 기준 — 구 명칭 "Tunnels"는 "Connectors"로 변경됨)
1. https://one.dash.cloudflare.com → **Networks → Connectors** → **Create a connector** (Cloudflared 선택)
2. 이름 입력(예: dealarchive-nas) → 설치 명령어 속 토큰(`eyJ...` 긴 문자열)만 복사
   (설치 명령 자체는 실행하지 않음 — compose의 cloudflared 컨테이너가 대신함)


# 1. 폴더 생성
sudo mkdir -p /volume1/docker/dealarchive

# 2. 터널 토큰 저장 (복사한 eyJ... 토큰으로 교체)
echo "TUNNEL_TOKEN=eyJhIjoi...전체토큰" | sudo tee /volume1/docker/dealarchive/.env




3. `/volume1/docker/dealarchive/.env` 파일 생성, 한 줄 입력: `TUNNEL_TOKEN=eyJ...복사한값`
4. 만든 커넥터 상세의 **Published application routes** 에서 추가:
   - Subdomain: `api` / Domain: 도메인.com
   - Service: `HTTP` / URL: `backend:4700`

## 5. 실행 (SSH)
```sh
cd /volume1/docker/dealarchive
sudo docker-compose up -d
```
확인:
```sh
sudo docker-compose ps                          # 세 컨테이너 Up 상태
curl http://localhost:4700/api/health           # 백엔드 응답
curl https://api.도메인.com/api/health           # 터널 경유 응답
```

## 6. 외부 서비스 설정
- **Google Cloud Console**: 승인된 리디렉션 URI에 `https://api.도메인.com/api/auth/google/callback` 추가
  (운영용 OAuth 클라이언트를 따로 만드는 것 권장)
- **Cloudflare Pages** (프론트): 빌드 환경변수 `VITE_API_BASE=https://api.도메인.com/api`

## 7. 이후 코드 반영 — 자동
`backend/` 를 수정하고 main에 push하면 끝. GitHub Actions가 이미지를 빌드해 올리고(2~3분),
NAS의 Watchtower가 2분 간격으로 확인해 자동 교체한다. NAS에 접속할 일 없음.
- 진행 확인: GitHub 리포 → Actions 탭 (빌드 성공 여부)
- 단, `backend.env` 값 변경은 NAS에서 직접 수정 후 `sudo docker-compose up -d` 재실행 필요

## 운영 주의사항
- DSM 자동 업데이트(재부팅 유발)는 새벽 시간대로 설정
- 컨테이너는 `restart: unless-stopped` 라 NAS 재부팅 시 자동 복구됨
- 중요한 시연 전 `https://api.도메인.com/api/health` 확인
- `backend.env`, `.env`(터널 토큰)는 NAS에만 존재 — git 커밋 금지
