export default function SunglassesLoading() {
  return (
    <div className="frames-page catalogue-page sunglasses-page" aria-busy="true">
      <section className="frames-hero">
        <div className="product-skeleton-block" style={{ position: "absolute", inset: 0 }} />
      </section>
      <section className="frames-catalogue wrap">
        <div className="frames-product-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="frames-product-skeleton" />
          ))}
        </div>
      </section>
    </div>
  );
}
