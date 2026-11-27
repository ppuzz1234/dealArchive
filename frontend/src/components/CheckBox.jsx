/* 새로 디자인한 체크박스 — 네이티브 input은 접근성/키보드 조작을 위해 유지하고 시각적으로만 감춘다 */
export default function CheckBox({ checked, onChange }) {
  return (
    <span className="check-box-wrap">
      <input type="checkbox" className="check-input" checked={checked} onChange={onChange} />
      <span className="check-box">
        <svg className="check-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      </span>
    </span>
  );
}
