import type { Metadata } from "next";
import DestinationPage from "@/components/home/DestinationPage";

export const metadata: Metadata = {
  title: "Eye Exams — LUMINA Optical",
  description: "Comprehensive eye examinations with modern diagnostics.",
};

export default function EyeExamsPage() {
  return (
    <DestinationPage
      destKey="exams"
      image="https://images.unsplash.com/photo-1551884170-09fb70a3a2ed?auto=format&fit=crop&w=1800&q=80"
      primaryHref="/book?service=Eye%20Examination"
      secondaryHref="/services"
      gallery={[
        "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1584036553516-bf27d479fd3d?auto=format&fit=crop&w=900&q=80",
        "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=900&q=80",
      ]}
    />
  );
}
