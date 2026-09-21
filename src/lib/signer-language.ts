export type SignerLanguage = "en" | "fr";

// Translate only known interface labels. Never translate stored waiver clauses,
// custom consent, field keys or submitted option values.
const french: Record<string, string> = {
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
const normalized = new Map(Object.entries(french).map(([key, value]) => [key.toLowerCase(), value]));
export function signerText(text: string, language: SignerLanguage): string {
  return language === "fr" ? normalized.get(text.trim().toLowerCase()) ?? text : text;
}

const standardLabels = new Set([
  "full legal name", "full name", "first name", "last name", "name", "email",
  "email address", "phone", "phone number", "date of birth", "birth date",
  "address", "city", "postal code", "emergency contact", "emergency contact name",
  "emergency contact phone", "initials",
]);
export function signerFieldLabel(text: string, language: SignerLanguage): string {
  return standardLabels.has(text.trim().toLowerCase()) ? signerText(text, language) : text;
}
