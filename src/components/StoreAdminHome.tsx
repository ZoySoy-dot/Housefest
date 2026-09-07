"use client";

import { useState } from "react";
import styles from "./AdminPanel.module.css";
import StoreAdmin from "./StoreAdmin";
import StoreOverview from "./StoreOverview";
import OrdersAdmin from "./OrdersAdmin";

type SubTab = "overview" | "products" | "orders";

export default function StoreAdminHome({
  onToast,
}: {
  onToast: (m: string, isError?: boolean) => void;
}) {
  const [tab, setTab] = useState<SubTab>("overview");

  return (
    <>
      <div className={styles.subTabs}>
        <button
          className={`${styles.subTabBtn} ${tab === "overview" ? styles.subTabBtnActive : ""}`}
          onClick={() => setTab("overview")}
        >Overview</button>
        <button
          className={`${styles.subTabBtn} ${tab === "products" ? styles.subTabBtnActive : ""}`}
          onClick={() => setTab("products")}
        >Products</button>
        <button
          className={`${styles.subTabBtn} ${tab === "orders" ? styles.subTabBtnActive : ""}`}
          onClick={() => setTab("orders")}
        >Orders</button>
      </div>

      {tab === "overview" && <StoreOverview />}
      {tab === "products" && (
        <section className={styles.section}>
          <StoreAdmin onToast={onToast} />
        </section>
      )}
      {tab === "orders" && <OrdersAdmin onToast={onToast} />}
    </>
  );
}
