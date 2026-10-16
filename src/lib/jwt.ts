import { JWT_SECRET } from "@/server/auth";
import {
  type JWTPayload,
  type JWTVerifyResult,
  SignJWT,
  jwtVerify,
} from "jose";

/**
 * How long a link sent to someone outside the app stays good: a data room, an
 * investor update, a document to sign. The recipient row it names is checked on
 * every open as well, so withdrawing access ends a link before it expires; a
 * fresh link is issued by sharing again.
 */
export const SHARE_TTL = "30d";

/** Signs a link token that expires after SHARE_TTL. */
export const encodeShare = async (data: JWTPayload) => {
  return await new SignJWT(data)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SHARE_TTL)
    .sign(JWT_SECRET);
};

/**
 * Verifies a link token. A token with no expiry is refused: every link this app
 * issues carries one, so one without it predates expiry and stays dead.
 */
export const decode = async (data: string) => {
  return await jwtVerify(data, JWT_SECRET, {
    algorithms: ["HS256"],
    requiredClaims: ["exp"],
  });
};

export type { JWTPayload, JWTVerifyResult };
