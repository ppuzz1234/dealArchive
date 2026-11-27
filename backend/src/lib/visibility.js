/* 담당자 자가 등급(담당자 본인의 A/B+/B/C 투표) 공개 규칙. 6대 지표는 항상 공개.
   담당자가 아닌 다른 담당자 REVEAL_MIN_PEER_VOTES명 이상이 투표하기 전까지는
   담당자 본인에게만 보이고, 다른 사람에게는 값 자체를 내려보내지 않는다(화면은 '?' 표시). */
export const REVEAL_MIN_PEER_VOTES = 3;

const GRADE_SCORE = { A: 4, "B+": 3, B: 2, C: 1 };

/* row: { owner_id, peer_votes } — peer_votes 는 담당자 본인을 제외한 투표 수 */
export function selfScoreHidden(row, userId) {
  return row.owner_id != null && row.owner_id !== userId && (row.peer_votes ?? 0) < REVEAL_MIN_PEER_VOTES;
}

/* DEAL_SELECT 결과 한 행을 보는 사람 기준으로 가린다.
   담당자 표가 섞인 집계(투표 수·평균·등급 분포)로 역산할 수 없도록 집계에서도 담당자 표를 뺀다. */
export function maskDeal(row, userId) {
  const hidden = selfScoreHidden(row, userId);
  const out = { ...row, self_hidden: hidden, reveal_min: REVEAL_MIN_PEER_VOTES };
  if (!hidden) return out;
  if (row.owner_grade) {
    const grades = [...(row.grades || [])];
    const i = grades.indexOf(row.owner_grade);
    if (i >= 0) grades.splice(i, 1);
    out.grades = grades;
    out.vote_count = grades.length;
    out.avg_score = grades.length ? grades.reduce((s, g) => s + (GRADE_SCORE[g] ?? 1), 0) / grades.length : null;
  }
  out.owner_grade = null;
  return out;
}
