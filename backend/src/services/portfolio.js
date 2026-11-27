import { pool } from "../db.js";
import { manToKrw, krwToMan } from "../lib/money.js";

/* 포트폴리오(보유 포지션) 서비스.
   프론트는 만원 단위(hnwHoldings.amount), DB는 원 단위(holding.amount_krw) —
   환산은 전부 여기(API 경계)에서 처리한다(2026-07-09 의사결정). */

// 유저의 활성 보유내역 — 프론트 hnwHoldings 형태(dealSlug, 만원)로 변환해 반환
export async function listHoldings(userId) {
  if (!pool) return null;
  const r = await pool.query(
    `select h.id, h.amount_krw, h.status, h.invested_at, d.slug as deal_slug
       from holding h
       join deal d on d.id = h.deal_id
      where h.lp_user_id = $1 and h.status = 'active'
      order by h.invested_at`,
    [userId]
  );
  return r.rows.map((x) => ({
    holdingId: x.id,
    dealId: x.deal_slug,
    amount: krwToMan(x.amount_krw),
    investedAt: new Date(x.invested_at).getTime(),
  }));
}

// 투자 체결 — deal slug로 딜을 찾아 holding 생성 (amount는 만원 단위 입력)
export async function createHolding({ userId, dealSlug, amountMan }) {
  if (!pool) return null;
  const deal = await pool.query(`select id from deal where slug = $1`, [dealSlug]);
  if (deal.rowCount === 0) throw new Error(`딜을 찾을 수 없습니다: ${dealSlug}`);
  const r = await pool.query(
    `insert into holding (lp_user_id, deal_id, amount_krw, vehicle)
     values ($1, $2, $3, 'trust')
     returning id, invested_at`,
    [userId, deal.rows[0].id, manToKrw(amountMan)]
  );
  return { holdingId: r.rows[0].id, investedAt: new Date(r.rows[0].invested_at).getTime() };
}

// 매도(청산) — 상태 전이만. 화면의 매도 기능 재활성화 시 사용.
export async function exitHolding(holdingId, userId) {
  if (!pool) return null;
  const r = await pool.query(
    `update holding set status = 'exited', exited_at = now()
      where id = $1 and lp_user_id = $2 and status = 'active'
      returning id`,
    [holdingId, userId]
  );
  return r.rowCount > 0;
}
