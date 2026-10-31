import Image from "next/image";

/** Premium lens art from reference (Image 2); contained, no crop. */
export default function LensSizeModalIllustration() {
  return (
    <div className="admin-lens-size-art-stage">
      <Image
        src="/admin-lens-size-modal-lenses.png"
        alt=""
        fill
        sizes="180px"
        className="admin-lens-size-art-photo"
        priority={false}
        draggable={false}
      />
    </div>
  );
}
