# Performance baseline and implemented response

Lighthouse ran against the existing production homepage on 2026-11-16 using installed Chromium and the mobile configuration. Raw report: `lighthouse-home-mobile.json`. The lab reported performance 67, accessibility 97, SEO 100; LCP 1.3s, CLS 0, total blocking time 3,860ms, document response 90ms and 592 KiB total transfer. It warned that this host CPU was slower than expected. These results are a single diagnostic run, not a claim of field performance, INP or ranking quality. A 100 SEO lab score did not detect the live homepage `/index` canonical conflict confirmed separately.

PageSpeed Insights API returned HTTP 429 quota exceeded; raw response retained. No CrUX/GSC field metrics were available. Do not substitute total blocking time for INP.

Confirmed issues addressed in source:

- Empty comparison-table column header and data cells missing appropriate row headers: added Provider heading and explicit scopes.
- Low-contrast hero footnote, footer legal/contact text and final-CTA trust text: removed unnecessary opacity. No hero layout or animation redesign.
- Below-fold signing sandbox and signature-pad code were included in the initial homepage client graph. A small client boundary now imports the sandbox only near its viewport (or on explicit click). The real public signing component and all signing logic are unchanged. A reserved minimum height reduces demo-loading shifts, and server-rendered explanatory copy remains available.

The hero already pauses its loop outside the viewport and respects reduced motion. Existing images have dimensions/sizes and optimized WebP assets. Font loading remains Next font with the existing family. Third-party measurement requires consent; the analytics review adds scope/rollout safeguards but makes no field-CWV claim.

Re-run the same Lighthouse configuration after the final build or approved release, on an otherwise idle host. Save the report, CPU warning and consent state. Compare script transfer, main-thread work, LCP and CLS; do not promise a score increase from deferring one component. Assess real INP using subsequent field data.

## Second production diagnostic

The existing production fitness-studio page was also measured on 2026-11-16 (`lighthouse-gym-mobile.json`): performance 69, accessibility 96, SEO 100; LCP 1.3s, CLS 0, TBT 2,290ms, document response 80ms, transfer 453 KiB. The same slow-host CPU warning applies. This is another pre-release diagnostic, not an after-change comparison. Its contrast findings include shared footer text addressed in this stack; a full accessibility certification is not claimed.
