"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./AdminPanel.module.css";
import ScoreboardAdmin from "./ScoreboardAdmin";
import StoreAdminHome from "./StoreAdminHome";

type TopTab = "scoreboard" | "store";

export default function AdminPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("section") as TopTab | null) === "store"
    ? "store"
    : "scoreboard";

  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<TopTab>(initialTab);

  // Keep URL in sync so refresh preserves the tab
  useEffect(() => {
    if (!authed) return;
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "scoreboard") params.delete("section");
    else params.set("section", tab);
    const q = params.toString();
    router.replace(q ? `?${q}` : "?", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, authed]);

  async function login() {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) { setAuthed(true); setLoginError(""); }
    else setLoginError("Wrong password.");
  }

  function flash(m: string, isError = false) {
    setMsg((isError ? "⚠ " : "") + m);
    setTimeout(() => setMsg(""), 2500);
  }

  if (!authed) {
    return (
      <div className={styles.loginWrap}>
        <div className={styles.loginCard}>
          <img src="/DLSU_Logo.svg" alt="DLSU" className={styles.loginLogo} />
          <h1 className={styles.loginTitle}>Housefest Admin</h1>
          <p className={styles.loginSub}>Sign in to manage games and scores</p>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            className={styles.loginInput}
            autoFocus
          />
          {loginError && <p className={styles.loginError}>{loginError}</p>}
          <button onClick={login} className={styles.loginBtn}>Sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <img src="/SC_Logo.svg" alt="SC" className={styles.brandLogo} />
          <div className={styles.brandText}>
            <span className={styles.brandLine1}>STUDENT</span>
            <span className={styles.brandLine2}>COUNCIL</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <a href="/" className={styles.viewBtn}>Scoreboard</a>
          <a href="/store" className={styles.viewBtn}>Storefront</a>
        </div>
      </header>

      {/* Top-level section tabs */}
      <nav className={styles.tabNav} aria-label="Admin sections">
        <button
          className={`${styles.tabBtn} ${tab === "scoreboard" ? styles.tabBtnActive : ""}`}
          onClick={() => setTab("scoreboard")}
        >Scoreboard</button>
        <button
          className={`${styles.tabBtn} ${tab === "store" ? styles.tabBtnActive : ""}`}
          onClick={() => setTab("store")}
        >Store</button>
      </nav>

      {msg && <div className={styles.toast}>{msg}</div>}

      {tab === "scoreboard" ? (
        <ScoreboardAdmin onToast={flash} />
      ) : (
        <StoreAdminHome onToast={flash} />
      )}
    </div>
  );
}
