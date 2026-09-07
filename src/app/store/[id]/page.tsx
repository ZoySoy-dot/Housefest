import ProductDetailClient from "@/components/ProductDetailClient";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductDetailClient productId={Number(id)} />;
}
