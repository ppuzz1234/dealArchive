import { pool } from "../db.js";

/* OAuth 로그인 성공 시 유저를 DB에 반영한다.
   - (provider, provider_uid)로 auth_identity 조회 → 있으면 프로필 필드 갱신,
     없으면 user_master + auth_identity 신규 생성 (스키마 설계 원칙 1: UserMaster가 SSOT).
   - 반환: { userId, isNew, roles } — roles는 온보딩 완료 여부 판단에 사용
     (user_role 행이 있으면 온보딩을 끝낸 기존 유저).
   - DATABASE_URL 미설정이면 null 반환 — 로그인 흐름 자체는 DB 없이도 동작. */
export async function upsertOAuthUser({ provider, providerUid, email, name, nickname, profileImageUrl, rawProfile }) {
  if (!pool) return null;
  const client = await pool.connect();
  try {
    await client.query("begin");

    const updated = await client.query(
      `update auth_identity
          set email = coalesce($3, email),
              nickname = coalesce($4, nickname),
              profile_image_url = coalesce($5, profile_image_url),
              raw_profile = coalesce($6, raw_profile)
        where provider = $1 and provider_uid = $2
        returning user_id`,
      [provider, providerUid, email || null, nickname || null, profileImageUrl || null, rawProfile || null]
    );

    let userId;
    let isNew = false;
    if (updated.rowCount > 0) {
      userId = updated.rows[0].user_id;
    } else {
      isNew = true;
      const u = await client.query(
        `insert into user_master (display_name) values ($1) returning id`,
        [name || nickname || null]
      );
      userId = u.rows[0].id;
      await client.query(
        `insert into auth_identity (user_id, provider, provider_uid, email, nickname, profile_image_url, raw_profile)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, provider, providerUid, email || null, nickname || null, profileImageUrl || null, rawProfile || null]
      );
    }

    await client.query("commit");

    const r = await client.query(
      `select role from user_role where user_id = $1 and status = 'active' order by granted_at`,
      [userId]
    );
    return { userId, isNew, roles: r.rows.map((x) => x.role) };
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

/* 세션 복원용 — userId로 유저 + 역할 + 대표 로그인 수단 프로필을 조회 */
export async function getUserWithRoles(userId) {
  if (!pool) return null;
  const u = await pool.query(
    `select id, display_name from user_master where id = $1 and status = 'active'`,
    [userId]
  );
  if (u.rowCount === 0) return null;
  const [roles, identity] = await Promise.all([
    pool.query(`select role from user_role where user_id = $1 and status = 'active' order by granted_at`, [userId]),
    pool.query(
      `select provider, email, nickname, profile_image_url
         from auth_identity where user_id = $1 order by created_at limit 1`,
      [userId]
    ),
  ]);
  const id = identity.rows[0] || {};
  return {
    userId: u.rows[0].id,
    name: u.rows[0].display_name || id.nickname || "",
    email: id.email || "",
    nickname: id.nickname || "",
    profileImage: id.profile_image_url || "",
    provider: id.provider || null,
    roles: roles.rows.map((x) => x.role),
    isNewUser: false,
  };
}

/* 온보딩 완료 시점에 역할을 기록한다. 이미 있으면 무시(재온보딩 대비). */
const VALID_ROLES = new Set(["lp_individual", "lp_institution", "gp", "admin"]);

export async function saveUserRole(userId, role) {
  if (!pool) return false;
  if (!VALID_ROLES.has(role)) throw new Error(`알 수 없는 역할: ${role}`);
  await pool.query(
    `insert into user_role (user_id, role) values ($1, $2)
     on conflict (user_id, role) do nothing`,
    [userId, role]
  );
  return true;
}
