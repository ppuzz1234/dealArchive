# 폰트 업로드 위치 (frontend/public/fonts/)

이 프로젝트는 본문 / 제목 / BI(브랜드 워드마크) 세 가지 용도로 폰트를 분리해서 관리합니다.
실제 폰트 파일(웹폰트, `.woff2` 권장)을 아래 세 폴더에 용도에 맞게 넣고,
`frontend/src/styles.css` 상단의 `@font-face` 주석을 해제 + 파일명만 맞추면 바로 적용됩니다.

```
frontend/public/fonts/
  body/       ← 본문 텍스트(설명, 목록, 버튼 등 대부분의 텍스트)
  heading/    ← 화면 제목·섹션 타이틀(예: view-title, story-title, wl-title 등)
  brand/      ← "PLUS Barbell" 브랜드 워드마크 전용(스플래시, 로그인, 사이드바 로고 등)
```

## 사용 방법
1. 폰트 파일(`.woff2`, 없으면 `.woff`/`.ttf`)을 해당 폴더에 넣습니다.
   - 예: `body/Pretendard-Regular.woff2`, `heading/Pretendard-Bold.woff2`, `brand/YourBrandFont-Black.woff2`
2. `frontend/src/styles.css`의 `/* 폰트 시스템 */` 섹션에 있는 `@font-face` 블록의
   `font-family`/`src` 값을 실제 파일명에 맞춰 수정하고 주석을 해제합니다.
3. 같은 섹션의 `--font-body`, `--font-heading`, `--font-brand` 변수 맨 앞에
   방금 등록한 폰트 이름을 추가합니다. (기존 구글 폰트/시스템 폰트는 그대로 폴백으로 남겨두면
   파일이 아직 없거나 로드에 실패해도 화면이 깨지지 않습니다.)

## 폴더별 참고
- `body/`: 가독성이 중요하므로 Regular/Medium 두 가지 굵기 정도면 충분합니다.
- `heading/`: 화면 제목에 쓰이는 굵은 웨이트(Bold~Black) 위주로 준비하세요.
- `brand/`: 로고성 텍스트 하나에만 쓰이므로 보통 1~2개 굵기(Bold/Black)면 충분합니다.
