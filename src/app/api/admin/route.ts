import { NextRequest, NextResponse } from "next/server";

// POST /api/admin — verify password, return simple token
export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (password === process.env.ADMIN_PASSWORD) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("admin_auth", process.env.ADMIN_PASSWORD!, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
    });
    return res;
  }
  return NextResponse.json({ error: "Invalid password" }, { status: 401 });
}
