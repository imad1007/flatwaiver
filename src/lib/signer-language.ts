import { additionalLanguages, translationRows } from "./signer-translations";

export const SIGNER_LANGUAGES = [
  { code: "en", name: "English" }, { code: "fr", name: "Français" },
  { code: "es", name: "Español" }, { code: "pt", name: "Português" },
  { code: "zh", name: "中文（简体）" }, { code: "hi", name: "हिन्दी" },
  { code: "ar", name: "العربية" }, { code: "bn", name: "বাংলা" },
  { code: "ru", name: "Русский" }, { code: "ur", name: "اردو" },
] as const;
export type SignerLanguage = typeof SIGNER_LANGUAGES[number]["code"];
export function signerLanguage(value: unknown): SignerLanguage {
  return SIGNER_LANGUAGES.find(l => l.code === value)?.code ?? "en";
}
export function signerDirection(language: SignerLanguage): "rtl" | "ltr" {
  return language === "ar" || language === "ur" ? "rtl" : "ltr";
}

// Translate only known interface labels. Never translate stored waiver clauses,
// custom consent, field keys or submitted option values.
const french: Record<string, string> = {
  "Signature": "Signature",
  "Language": "Langue",
  "Waiver text and custom fields remain in their original language.": "Les clauses et les champs personnalisés restent dans leur langue d’origine.",
  "Please read the waiver below, fill in your details, and sign.": "Veuillez lire le document ci-dessous, remplir vos informations et signer.",
  "Full legal name": "Nom légal complet",
  "Full name": "Nom complet", "First name": "Prénom", "Last name": "Nom de famille",
  "Name": "Nom", "Email": "Adresse e-mail", "Email address": "Adresse e-mail",
  "Phone": "Téléphone", "Phone number": "Numéro de téléphone",
  "Date of birth": "Date de naissance", "Birth date": "Date de naissance",
  "Address": "Adresse", "City": "Ville", "Postal code": "Code postal",
  "Emergency contact": "Contact d’urgence", "Emergency contact name": "Nom du contact d’urgence",
  "Emergency contact phone": "Téléphone du contact d’urgence", "Initials": "Initiales",
  "Select…": "Sélectionner…", "Yes": "Oui", "No": "Non",
  "The participant is under 18": "Le participant a moins de 18 ans",
  "Parent / guardian full legal name": "Nom légal complet du parent ou du représentant légal",
  "Relationship to participant": "Lien avec le participant", "e.g. Parent": "Ex. : parent",
  "Parent / guardian signature": "Signature du parent ou du représentant légal",
  "Your signature": "Votre signature", "Draw": "Dessiner", "Type": "Saisir",
  "Clear drawing": "Effacer la signature", "drawing area": "zone de signature",
  "Draw with a pointer, or choose Type for keyboard entry.": "Dessinez votre signature ou choisissez Saisir pour utiliser le clavier.",
  "Type your full signature": "Saisissez votre signature complète",
  "Your typed signature will appear in the signed PDF.": "Votre signature saisie apparaîtra dans le PDF signé.",
  "Please draw or type your signature.": "Veuillez dessiner ou saisir votre signature.",
  "Guardian signature is required for minors.": "La signature du représentant légal est obligatoire pour les mineurs.",
  "You must agree to sign electronically.": "Vous devez accepter de signer électroniquement.",
  "A photo is required to sign this waiver.": "Une photo est nécessaire pour signer ce document.",
  "Please complete the verification challenge.": "Veuillez effectuer la vérification de sécurité.",
  "Couldn't read that photo. Try again or use a different image.": "Impossible de lire cette photo. Réessayez ou choisissez une autre image.",
  "Something went wrong. Please try again.": "Une erreur est survenue. Veuillez réessayer.",
  "We couldn't reach the signing service. Check your connection and try again; your entries are still here.": "Le service de signature est inaccessible. Vérifiez votre connexion et réessayez ; vos réponses sont conservées.",
  "You're all set!": "C’est fait !",
  "Your waiver has been signed and recorded.": "Votre document a été signé et enregistré.",
  "Ready for the next person in a few seconds…": "Le formulaire sera prêt pour la prochaine personne dans quelques secondes…",
  "Shared device: entries clear after 3 minutes without activity.": "Appareil partagé : les réponses sont effacées après 3 minutes d’inactivité.",
  "Clear form": "Effacer le formulaire",
  "Please describe the medical condition — this is required because you answered yes.": "Veuillez préciser le problème médical, car vous avez répondu oui.",
  "Photo": "Photo", "Captured": "Photo sélectionnée", "Retake": "Reprendre",
  "Optionally add a photo (e.g. a photo ID or a selfie).": "Vous pouvez ajouter une photo (par exemple, une pièce d’identité ou un selfie).",
  "Processing…": "Traitement…", "Take / upload photo": "Prendre ou importer une photo",
  "We couldn't submit this waiver": "Impossible d’envoyer ce document",
  "Submitting…": "Envoi…", "Sign waiver": "Signer le document",
};
const catalogs: Partial<Record<SignerLanguage, Record<string, string>>> = { fr: french };
additionalLanguages.forEach((language, index) => {
  catalogs[language] = Object.fromEntries(Object.entries(translationRows).map(([key, values]) => [key, values[index]]));
});
const keys = new Map(Object.keys(french).map(key => [key.toLowerCase(), key]));
const aliases: Record<string, string> = {
  "your email": "Email", "your email address": "Email address",
  "e-mail": "Email", "your name": "Full name", "your full name": "Full name",
  "your phone": "Phone", "your phone number": "Phone number", "birth date": "Date of birth",
};
export function signerText(text: string, language: SignerLanguage): string {
  const normalized = text.trim().toLowerCase();
  const key = aliases[normalized] ?? keys.get(normalized);
  return language === "en" || !key ? text : catalogs[language]?.[key] ?? text;
}

const standardLabels = new Set([
  "full legal name", "full name", "first name", "last name", "name", "email",
  "email address", "phone", "phone number", "date of birth", "birth date",
  "address", "city", "postal code", "emergency contact", "emergency contact name",
  "emergency contact phone", "initials", "signature", "your signature",
  ...Object.keys(aliases),
]);
export function signerFieldLabel(text: string, language: SignerLanguage): string {
  return standardLabels.has(text.trim().toLowerCase()) ? signerText(text, language) : text;
}
