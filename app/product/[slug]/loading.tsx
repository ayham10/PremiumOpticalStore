export default function ProductLoading() {
  return (
    <div className="product-page" aria-busy="true">
      <div className="product-page-inner wrap">
        <div className="product-layout">
          <div className="product-gallery">
            <div className="product-image-frame product-skeleton-block" />
          </div>
          <div className="product-info">
            <span className="product-skeleton-line" style={{ width: "30%" }} />
            <span className="product-skeleton-line" style={{ width: "70%", height: "1.6rem" }} />
            <span className="product-skeleton-line" style={{ width: "40%" }} />
            <span className="product-skeleton-line" style={{ width: "25%", height: "1.4rem" }} />
            <span className="product-skeleton-line" style={{ width: "100%", height: "4rem" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
