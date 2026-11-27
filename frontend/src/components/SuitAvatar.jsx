/* 딜소싱 담당자 노트용 기본 아바타 — 실제 프로필 사진이 없는 운용역을 위해
   정장 차림 남성 실루엣을 카툰 스타일로 표현한 고정 아이콘. */
export default function SuitAvatar() {
  return (
    <svg viewBox="0 0 36 36" width="100%" height="100%" aria-hidden="true">
      <circle cx="18" cy="14" r="6.6" fill="#F0B88A" />
      <path d="M3 36c0-10 6.7-16 15-16s15 6 15 16z" fill="#2B3A55" />
      <path d="M13 21.6 18 36 23 21.6 18 26.2z" fill="#F4F6F8" />
      <path d="M17 22.4h2l.5 3-1.5 9-1.5-9z" fill="var(--mint)" />
    </svg>
  );
}
