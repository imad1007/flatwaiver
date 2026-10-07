import { IndustryLanding, industryMetadata } from "@/components/marketing/industry-landing";
import { industries } from "@/lib/industries";

const industry = industries.find((item) => item.slug === "axe-throwing")!;
export const metadata = industryMetadata(industry);

export default function Page() {
  return <IndustryLanding industry={industry} />;
}
