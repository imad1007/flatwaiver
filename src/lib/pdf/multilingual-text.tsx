import "server-only";
import React from "react";
import path from "node:path";
import { Font, Text as PdfText, type TextProps } from "@react-pdf/renderer";

const families = ["Latin", "Devanagari", "Bengali", "Chinese"] as const;
for (const family of families) {
  const src = path.join(process.cwd(), "public/fonts/waivers", `${family}.ttf`);
  // Evidence consent uses italic styling; scripts without a separate italic
  // face retain their normal glyphs instead of failing font resolution.
  Font.register({ family: `Waiver${family}`, fonts: [{ src }, { src, fontStyle: "italic" }] });
}

/** Keep existing Latin layout; supply embedded glyphs for other scripts. */
export function MultilingualText(props: React.PropsWithChildren<TextProps>) {
  const content = React.Children.toArray(props.children).filter(v => typeof v === "string" || typeof v === "number").join("");
  const fallbacks: string[] = [];
  if (/\p{Script=Cyrillic}/u.test(content)) fallbacks.push("WaiverLatin");
  if (/\p{Script=Devanagari}/u.test(content)) fallbacks.push("WaiverDevanagari");
  if (/\p{Script=Bengali}/u.test(content)) fallbacks.push("WaiverBengali");
  if (/\p{Script=Han}/u.test(content)) fallbacks.push("WaiverChinese");
  if (!fallbacks.length) return <PdfText {...props} />;
  const styles = Array.isArray(props.style) ? props.style : [props.style ?? {}];
  return <PdfText {...props} style={[...styles, {
    fontFamily: [...fallbacks, "WaiverLatin"],
  }]} />;
}
