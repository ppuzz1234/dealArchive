# DealArchive 백엔드 — NAS/클라우드 공용 컨테이너 이미지
FROM node:20-alpine
WORKDIR /app

# 의존성 먼저 복사·설치 (소스 변경 시에도 레이어 캐시 활용)
COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 4700
CMD ["node", "src/index.js"]
