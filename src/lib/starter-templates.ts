import {
  Camera,
  Dumbbell,
  Mountain,
  PawPrint,
  PenLine,
  Scissors,
  ShieldCheck,
  Sparkles,
  Swords,
  Syringe,
  type LucideIcon,
} from "lucide-react";

/**
 * First-run starter waivers. Each is a *generic, editable starting point* — the
 * user picks one, it seeds a draft (via the same text→draft path as
 * createTemplateFromText), and they finish it in the editor. These are not legal
 * advice; the whole product frames waiver text as something a lawyer should
 * review. `[Business Name]` placeholders signal what to edit first.
 *
 * Icons live here (client-safe); the server action only reads `name` + `text`.
 */
export interface StarterTemplate {
  id: string;
  name: string;
  category: string;
  icon: LucideIcon;
  /** Blank-line-separated paragraphs → draft blocks. */
  text: string;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "general-liability",
    name: "General Liability Waiver",
    category: "General",
    icon: ShieldCheck,
    text: `Release of Liability and Assumption of Risk

I understand that participation in the activities offered by [Business Name] involves inherent risks, including the risk of injury, illness, property damage, or, in rare cases, death. I voluntarily choose to participate with full knowledge of these risks.

I assume all risks associated with my participation, whether known or unknown. In consideration of being permitted to participate, I release and hold harmless [Business Name], its owners, employees, and agents from any and all claims, demands, or causes of action arising out of my participation, to the fullest extent permitted by law.

I confirm that I am physically able to participate, that the information I have provided is accurate, and that I have read and understood this waiver before signing.`,
  },
  {
    id: "fitness-gym",
    name: "Fitness / Gym Waiver",
    category: "Fitness",
    icon: Dumbbell,
    text: `Fitness Activity Waiver and Release

I understand that exercise and use of the equipment and facilities at [Business Name] involve inherent risks, including muscle strains, sprains, cardiac events, and other injuries. I represent that I am in good physical condition and know of no medical reason preventing my participation.

I agree to use all equipment and facilities at my own risk and to follow posted rules and staff instructions. I release [Business Name], its owners, employees, and trainers from liability for any injury or loss arising from my use of the facilities, to the fullest extent permitted by law.

I acknowledge that it is my responsibility to consult a physician before beginning any exercise program, and that I have read and understood this waiver.`,
  },
  {
    id: "adventure-recreation",
    name: "Adventure / Recreation Waiver",
    category: "Adventure & Recreation",
    icon: Mountain,
    text: `Adventure Activity Release of Liability

I understand that the activities offered by [Business Name] are inherently dangerous and involve risks including falls, collisions, equipment failure, changing weather and terrain, and serious injury or death. I voluntarily accept and assume all such risks, known and unknown.

I agree to follow all safety instructions and to use provided safety equipment correctly. In consideration of being allowed to participate, I release and hold harmless [Business Name], its owners, guides, and employees from any claims arising out of my participation, to the fullest extent permitted by law.

I confirm that I am physically capable of participating, that I have disclosed any relevant medical conditions, and that I have read and understood this release.`,
  },
  {
    id: "martial-arts",
    name: "Martial Arts / Combat Sports Waiver",
    category: "Martial Arts",
    icon: Swords,
    text: `Martial Arts and Combat Sports Waiver

I understand that training in martial arts and combat sports at [Business Name] involves physical contact and inherent risks, including bruises, strains, fractures, concussions, and other serious injuries. I voluntarily assume all risks associated with training, sparring, and competition.

I represent that I am physically fit to participate and have disclosed any condition that could affect my safety. I agree to follow all instructor directions and gym rules. I release [Business Name], its owners, instructors, and training partners from liability for injuries arising out of my participation, to the fullest extent permitted by law.

I have read and understood this waiver and sign it voluntarily.`,
  },
  {
    id: "tattoo-piercing",
    name: "Tattoo / Piercing Consent",
    category: "Tattoo & Piercing",
    icon: Syringe,
    text: `Tattoo and Body Piercing Consent

I am voluntarily requesting a tattoo and/or body piercing procedure from [Business Name]. I confirm that I am of legal age, not under the influence of alcohol or drugs, and not pregnant or nursing (or have disclosed if I am).

I have disclosed any medical conditions, allergies, or medications that may affect the procedure or healing, including allergies to latex, inks, metals, or anesthetics. I understand the risks, which may include infection, allergic reaction, scarring, and dissatisfaction with the final result, and I have received and understand the aftercare instructions.

I release [Business Name] and its artists from liability for any complications arising from the procedure when aftercare instructions are not followed, to the fullest extent permitted by law. I have read and understood this consent form.`,
  },
  {
    id: "salon-spa",
    name: "Salon / Spa Consent",
    category: "Salon & Spa",
    icon: Scissors,
    text: `Salon and Spa Treatment Consent

I am voluntarily consenting to receive salon and/or spa services from [Business Name]. I confirm that I have disclosed any allergies, skin sensitivities, medical conditions, or medications that may affect my treatment.

I understand that results can vary and that some treatments carry risks such as allergic reaction, skin irritation, or discomfort. I agree to inform my provider immediately if I experience any adverse reaction during my service.

I release [Business Name] and its staff from liability for reactions or outcomes that arise despite reasonable care, to the fullest extent permitted by law. I have read and understood this consent form.`,
  },
  {
    id: "photo-video-release",
    name: "Photo / Video Release",
    category: "General",
    icon: Camera,
    text: `Photo and Video Release

I grant [Business Name] permission to photograph and record me (and any minor for whom I am the parent or guardian) during my visit or participation.

I authorize [Business Name] to use these photographs, video, and audio recordings for its marketing, promotional, social media, website, and internal purposes, in any medium, without compensation to me. I understand that these materials become the property of [Business Name].

I release [Business Name], its owners, and employees from any claims related to the use of my likeness. I confirm that I am of legal age and have read and understood this release.`,
  },
  {
    id: "pet-services",
    name: "Pet Services Waiver",
    category: "Pet Services",
    icon: PawPrint,
    text: `Pet Services Waiver and Release

I am requesting services for my pet from [Business Name], which may include grooming, boarding, daycare, training, or handling. I confirm that my pet is in good health, is up to date on required vaccinations, and has no history of aggression I have not disclosed.

I understand that handling animals involves inherent risks, including injury to my pet, injury to others, illness, or escape, and I assume these risks. In the event of a medical emergency, I authorize [Business Name] to seek veterinary care at my expense.

I release [Business Name] and its staff from liability for injury, illness, or loss arising from these services when reasonable care is provided, to the fullest extent permitted by law. I have read and understood this waiver.`,
  },
];

export const STARTER_BY_ID = new Map(STARTER_TEMPLATES.map((s) => [s.id, s]));

/** Special (non-template) first-run choices, rendered alongside the starters. */
export const SPECIAL_STARTERS: {
  id: "upload" | "blank";
  name: string;
  category: string;
  icon: LucideIcon;
  description: string;
}[] = [
  {
    id: "upload",
    name: "Upload your own waiver",
    category: "AI converts it",
    icon: Sparkles,
    description: "PDF, photo, or Word — AI converts it, clause for clause.",
  },
  {
    id: "blank",
    name: "Blank Waiver",
    category: "From scratch",
    icon: PenLine,
    description: "Start empty and build the form yourself in the editor.",
  },
];
