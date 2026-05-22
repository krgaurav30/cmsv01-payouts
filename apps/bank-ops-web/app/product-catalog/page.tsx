import { ConsoleNav } from "../ui/console-nav";
import { ProductCatalogPageClient } from "./page-client";

export default function ProductCatalogPage() {
  return (
    <main className="dashboard-shell">
      <ConsoleNav current="product-catalog" />
      <ProductCatalogPageClient />
    </main>
  );
}
