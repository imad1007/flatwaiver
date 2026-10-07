import { IndustryLanding, industryMetadata } from "@/components/marketing/industry-landing";
import { industries } from "@/lib/industries";

const industry = industries.find((item) => item.slug === "horseback-riding")!;
export const metadata = industryMetadata(industry);

export default function Page() {
  return <IndustryLanding industry={industry} />;
}
