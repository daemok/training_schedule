import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login", "/signup"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * 모든 화면/이의 API 요청은 로그인(세션 쿠키)이 있어야 통과한다. (요구사항: 인증되지
 * 않은 사용자는 어떤 화면에도 접근할 수 없어야 함)
 * 세션 검증은 pg(Node 전용 Postgres 드라이버)를 쓰지 않는 서명 검증만으로 이뤄지므로
 * Edge 런타임에서도 DB 조회 없이 실행된다.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 강사 전용 관리 화면 — 강사가 아닌 계정은 접근할 이유가 없으므로 각자의 홈으로 돌려보낸다.
  if (pathname.startsWith("/my-schedule") && session.role !== "INSTRUCTOR") {
    return NextResponse.redirect(
      new URL(session.role === "GENERAL" ? "/apply" : "/calendar", request.url)
    );
  }

  // 내부 운영 캘린더 — 일반 사용자(강의 신청자)는 강의 신청 화면만 사용한다.
  if (pathname.startsWith("/calendar") && session.role === "GENERAL") {
    return NextResponse.redirect(new URL("/apply", request.url));
  }

  // 강사 Pool/강의 유형/가입 승인 관리 — 팀장/매니저 전용.
  if (pathname.startsWith("/admin") && session.role !== "TEAM_LEAD" && session.role !== "MANAGER") {
    return NextResponse.redirect(
      new URL(
        session.role === "INSTRUCTOR" ? "/my-schedule" : session.role === "GENERAL" ? "/apply" : "/calendar",
        request.url
      )
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
