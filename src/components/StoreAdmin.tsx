"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./AdminPanel.module.css";
import ImageUploader from "./ImageUploader";

type Variant = {
  id: number;
  productId: number;
  group: string;
  option: string;
  price: number;   // centavos
  stock: number;
};

type Product = {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  sizeChartUrl: string | null;
  category: string | null;
  basePrice: number;   // centavos
  active: boolean;
  variants: Variant[];
};

function pesosToCentavos(p: string | number) {
  const n = typeof p === "number" ? p : parseFloat(p);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}
function centavosToPesos(c: number) {
  return (c / 100).toFixed(2);
}

export default function StoreAdmin({ onToast }: { onToast: (m: string, isError?: boolean) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [newProduct, setNewProduct] = useState<{
    name: string; category: string; basePrice: string; description: string;
    imageUrls: string[]; sizeChartUrl: string;
  }>({
    name: "", category: "", basePrice: "", description: "",
    imageUrls: [], sizeChartUrl: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/products?includeInactive=1");
    if (!res.ok) return;
    setProducts(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addProduct() {
    if (!newProduct.name.trim()) return;
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newProduct.name,
        category: newProduct.category,
        basePrice: pesosToCentavos(newProduct.basePrice),
        imageUrls: newProduct.imageUrls,
        sizeChartUrl: newProduct.sizeChartUrl || null,
        description: newProduct.description,
      }),
    });
    if (!res.ok) return onToast("Failed to add product.", true);
    setNewProduct({ name: "", category: "", basePrice: "", description: "", imageUrls: [], sizeChartUrl: "" });
    await load();
    onToast("Product added.");
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Store</h2>
        <span className={styles.sectionHint}>Manage merch products and variants</span>
      </div>

      {/* Add product form */}
      <div className={styles.productAddGrid}>
        <input
          placeholder="Product name (e.g. Housefest Shirt)"
          value={newProduct.name}
          onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
          className={styles.input}
        />
        <input
          placeholder="Category (e.g. Apparel)"
          value={newProduct.category}
          onChange={(e) => setNewProduct((p) => ({ ...p, category: e.target.value }))}
          className={styles.input}
        />
        <input
          placeholder="Base price (₱)"
          type="number"
          step="0.01"
          value={newProduct.basePrice}
          onChange={(e) => setNewProduct((p) => ({ ...p, basePrice: e.target.value }))}
          className={styles.input}
        />
        <textarea
          placeholder="Description (optional)"
          value={newProduct.description}
          onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
          className={`${styles.input} ${styles.productDesc}`}
          rows={2}
        />
        <div style={{ gridColumn: "1 / -1" }}>
          <ImageUploader
            urls={newProduct.imageUrls}
            onChange={(urls) => setNewProduct((p) => ({ ...p, imageUrls: urls }))}
            onToast={onToast}
            label="Product images (first = primary)"
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <ImageUploader
            urls={newProduct.sizeChartUrl ? [newProduct.sizeChartUrl] : []}
            onChange={(urls) => setNewProduct((p) => ({ ...p, sizeChartUrl: urls[0] ?? "" }))}
            onToast={onToast}
            single
            folder="size-charts"
            label="Size chart (optional)"
          />
        </div>
        <button onClick={addProduct} className={styles.addBtn}>+ Add product</button>
      </div>

      {products.length === 0 ? (
        <div className={styles.empty}>No products yet — add one above.</div>
      ) : (
        <div className={styles.productList}>
          {products.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              expanded={expanded.has(p.id)}
              onToggle={() => toggleExpand(p.id)}
              onChange={load}
              onToast={onToast}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ProductRow({
  product, expanded, onToggle, onChange, onToast,
}: {
  product: Product;
  expanded: boolean;
  onToggle: () => void;
  onChange: () => void | Promise<void>;
  onToast: (m: string, isError?: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const initialImages = product.imageUrls && product.imageUrls.length > 0
    ? product.imageUrls
    : (product.imageUrl ? [product.imageUrl] : []);
  const [draft, setDraft] = useState<{
    name: string; category: string; basePrice: string; description: string;
    imageUrls: string[]; sizeChartUrl: string;
  }>({
    name: product.name,
    category: product.category ?? "",
    basePrice: centavosToPesos(product.basePrice),
    description: product.description ?? "",
    imageUrls: initialImages,
    sizeChartUrl: product.sizeChartUrl ?? "",
  });

  async function saveEdit() {
    if (!draft.name.trim()) return;
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        category: draft.category,
        basePrice: pesosToCentavos(draft.basePrice),
        imageUrls: draft.imageUrls,
        sizeChartUrl: draft.sizeChartUrl || null,
        description: draft.description,
      }),
    });
    if (!res.ok) return onToast("Save failed.", true);
    setEditing(false);
    await onChange();
    onToast("Product updated.");
  }

  async function toggleActive() {
    await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !product.active }),
    });
    await onChange();
    onToast(product.active ? "Product hidden." : "Product visible.");
  }

  async function deleteProduct() {
    if (!confirm(`Delete "${product.name}" and all its variants? This cannot be undone.`)) return;
    await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    await onChange();
    onToast("Product deleted.");
  }

  return (
    <div className={styles.productCard}>
      <div className={styles.productHead}>
        <div className={styles.productThumb}>
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" />
          ) : (
            <div className={styles.productThumbEmpty}>—</div>
          )}
        </div>

        <div className={styles.productInfo}>
          {editing ? (
            <div className={styles.editForm}>
              <label className={styles.editLabel}>
                <span>Name</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                  className={styles.input}
                />
              </label>
              <label className={styles.editLabel}>
                <span>Category</span>
                <input
                  value={draft.category}
                  onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}
                  className={styles.input}
                />
              </label>
              <label className={styles.editLabel}>
                <span>Base price (₱)</span>
                <input
                  type="number"
                  step="0.01"
                  value={draft.basePrice}
                  onChange={(e) => setDraft((p) => ({ ...p, basePrice: e.target.value }))}
                  className={styles.input}
                />
              </label>
              <div className={`${styles.editLabel} ${styles.editLabelFull}`}>
                <ImageUploader
                  urls={draft.imageUrls}
                  onChange={(urls) => setDraft((p) => ({ ...p, imageUrls: urls }))}
                  onToast={onToast}
                  label="Product images (first = primary · drag to reorder)"
                />
              </div>
              <div className={`${styles.editLabel} ${styles.editLabelFull}`}>
                <ImageUploader
                  urls={draft.sizeChartUrl ? [draft.sizeChartUrl] : []}
                  onChange={(urls) => setDraft((p) => ({ ...p, sizeChartUrl: urls[0] ?? "" }))}
                  onToast={onToast}
                  single
                  folder="size-charts"
                  label="Size chart (optional)"
                />
              </div>
              <label className={`${styles.editLabel} ${styles.editLabelFull}`}>
                <span>Description</span>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                  className={styles.input}
                  rows={3}
                />
              </label>
              <div className={styles.editActions}>
                <button className={styles.addBtn} onClick={saveEdit}>Save</button>
                <button className={styles.chipBtn} onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.productTitleRow}>
                <span className={styles.chipName}>{product.name}</span>
                {!product.active && <span className={styles.pausedBadge}>Hidden</span>}
              </div>
              <div className={styles.productMeta}>
                <span className={styles.metaItem}>
                  Category: <span>{product.category || "—"}</span>
                </span>
                <span className={styles.metaItem}>
                  Base price: <span>₱{centavosToPesos(product.basePrice)}</span>
                </span>
                <span className={styles.metaItem}>
                  Variants: <span>{product.variants.length}</span>
                </span>
              </div>
            </>
          )}
        </div>

        {!editing && (
          <div className={styles.productActions}>
            <button className={styles.chipBtn} onClick={onToggle}>
              {expanded ? "Hide variants" : "Variants"}
            </button>
            <button className={styles.chipBtn} onClick={() => setEditing(true)}>Edit</button>
            <button className={styles.chipBtn} onClick={toggleActive}>
              {product.active ? "Hide" : "Show"}
            </button>
            <button
              className={`${styles.chipBtn} ${styles.chipBtnDanger}`}
              onClick={deleteProduct}
            >Delete</button>
          </div>
        )}
      </div>

      {expanded && !editing && (
        <VariantsPanel product={product} onChange={onChange} onToast={onToast} />
      )}
    </div>
  );
}

function VariantsPanel({
  product, onChange, onToast,
}: {
  product: Product;
  onChange: () => void | Promise<void>;
  onToast: (m: string, isError?: boolean) => void;
}) {
  const [newVariant, setNewVariant] = useState({ group: "", option: "", price: "", stock: "" });

  async function addVariant() {
    if (!newVariant.group.trim() || !newVariant.option.trim()) {
      return onToast("Group and option required.", true);
    }
    const res = await fetch(`/api/products/${product.id}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group: newVariant.group,
        option: newVariant.option,
        price: pesosToCentavos(newVariant.price || "0"),
        stock: Number(newVariant.stock) || 0,
      }),
    });
    if (!res.ok) return onToast("Failed to add variant.", true);
    setNewVariant({ group: "", option: "", price: "", stock: "" });
    await onChange();
    onToast("Variant added.");
  }

  return (
    <div className={styles.variantsPanel}>
      {product.variants.length === 0 ? (
        <div className={styles.variantEmpty}>
          No variants yet. Add sizes, colors, or other options below.
        </div>
      ) : (
        <div className={styles.variantList}>
          <div className={styles.variantHeader}>
            <span>Group</span>
            <span>Option</span>
            <span>Price (₱)</span>
            <span>Stock</span>
            <span></span>
          </div>
          {product.variants.map((v) => (
            <VariantRow key={v.id} variant={v} onChange={onChange} onToast={onToast} />
          ))}
        </div>
      )}

      <div className={styles.variantAdd}>
        <input
          placeholder="Group (e.g. Size)"
          value={newVariant.group}
          onChange={(e) => setNewVariant((p) => ({ ...p, group: e.target.value }))}
          className={styles.input}
        />
        <input
          placeholder="Option (e.g. M)"
          value={newVariant.option}
          onChange={(e) => setNewVariant((p) => ({ ...p, option: e.target.value }))}
          className={styles.input}
        />
        <input
          placeholder="Price (₱)"
          type="number"
          step="0.01"
          value={newVariant.price}
          onChange={(e) => setNewVariant((p) => ({ ...p, price: e.target.value }))}
          className={styles.input}
        />
        <input
          placeholder="Stock"
          type="number"
          value={newVariant.stock}
          onChange={(e) => setNewVariant((p) => ({ ...p, stock: e.target.value }))}
          className={styles.input}
        />
        <button className={styles.addBtn} onClick={addVariant}>+ Add</button>
      </div>
    </div>
  );
}

function VariantRow({
  variant, onChange, onToast,
}: {
  variant: Variant;
  onChange: () => void | Promise<void>;
  onToast: (m: string, isError?: boolean) => void;
}) {
  const [draft, setDraft] = useState({
    group: variant.group,
    option: variant.option,
    price: centavosToPesos(variant.price),
    stock: String(variant.stock),
  });
  const [dirty, setDirty] = useState(false);

  function update<K extends keyof typeof draft>(key: K, value: string) {
    setDraft((p) => ({ ...p, [key]: value }));
    setDirty(true);
  }

  async function save() {
    const res = await fetch(`/api/variants/${variant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group: draft.group,
        option: draft.option,
        price: pesosToCentavos(draft.price),
        stock: Number(draft.stock) || 0,
      }),
    });
    if (!res.ok) return onToast("Save failed.", true);
    setDirty(false);
    await onChange();
    onToast("Variant saved.");
  }

  async function remove() {
    if (!confirm(`Delete variant ${draft.group}: ${draft.option}?`)) return;
    await fetch(`/api/variants/${variant.id}`, { method: "DELETE" });
    await onChange();
    onToast("Variant deleted.");
  }

  return (
    <div className={styles.variantRow}>
      <input
        value={draft.group}
        onChange={(e) => update("group", e.target.value)}
        className={styles.input}
      />
      <input
        value={draft.option}
        onChange={(e) => update("option", e.target.value)}
        className={styles.input}
      />
      <input
        type="number"
        step="0.01"
        value={draft.price}
        onChange={(e) => update("price", e.target.value)}
        className={styles.input}
      />
      <input
        type="number"
        value={draft.stock}
        onChange={(e) => update("stock", e.target.value)}
        className={styles.input}
      />
      <div className={styles.variantRowActions}>
        <button
          className={styles.chipBtn}
          onClick={save}
          disabled={!dirty}
        >{dirty ? "Save" : "Saved"}</button>
        <button
          className={`${styles.chipBtn} ${styles.chipBtnDanger}`}
          onClick={remove}
        >×</button>
      </div>
    </div>
  );
}
