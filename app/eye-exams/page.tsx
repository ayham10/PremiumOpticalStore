import type { Metadata } from "next";
import EyeExamPage from "@/components/eye-exam/EyeExamPage";

export const metadata: Metadata = {
  title: "Eye Exam — LUMINA Optical",
  description:
    "Book a professional eye examination. Choose an available date and time that suits you.",
};

export default function EyeExamsRoute() {
  return <EyeExamPage />;
}
