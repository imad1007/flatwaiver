# Signer languages

The interface supports English, French, Spanish, Portuguese, Simplified Chinese,
Hindi, Arabic, Bengali, Russian and Urdu. These are ten widely spoken languages,
not a claim about an exact worldwide ranking. Arabic and Urdu use right-to-left
layout. Translation catalogs are local; no waiver or participant data is sent
to a translation service. No new runtime dependency is required.

## Editor workflow

Open a waiver, find **Signer language**, select the default language and check
the live preview. Save and publish to pin the language to a new template version.
Existing published versions and signatures are not rewritten. A signer can
still switch interface language; kiosk reset restores the published default.

Standard labels such as **Your Email**, **Full legal name**, **Signature**, minor
and guardian controls, buttons, validation messages and completion screens are
translated. Custom labels, questions, choices and waiver paragraphs stay as
authored unless the owner explicitly uses full-document translation below.
Field keys, option values, flags and submitted answers remain unchanged.

Consent is legal content, not an interface label. It is displayed verbatim from
the immutable published version and the same text is saved in the signature
snapshot and PDF. When French is selected and the consent still exactly matches
FlatWaiver's English default, **Use French translation of default consent** fills
the draft textarea. Review it before publishing. Custom consent is never
replaced. Other-language consent can be authored manually; it is not translated
by changing the interface selector. Full-document translation and its PDF script limits are described below.

## Deployment

Apply `0020_signer_languages.sql` before deploying the new publisher. The old
six-argument RPC remains for older clients; the new RPC takes the language
explicitly and keeps the same role checks, lock and atomic publication.
Existing versions default to English. No backfill or production migration is
performed by the implementation.

## Adding languages

Add the locale/name to `SIGNER_LANGUAGES`, provide every interface message in
the catalog, update the draft enum and add a migration extending the version
language constraint. Run both signer-language verification scripts. Have a
fluent reviewer check wording before relying on it for a particular audience.
Libraries such as i18next can manage larger catalogs, but translations still
need to be supplied and reviewed. No API key is needed for interface translations.

## Opt-in full-document translation

The editor now includes **Translate the entire waiver**. Select the target
language, enable this checkbox, generate a translation, review the preview and
choose **Use this translation**. Save and publish to create a new immutable
version. The original published versions and signed records stay unchanged.

This explicitly requested action translates the title, paragraphs, lists,
custom field labels, displayed choice labels and complete consent clause.
Internal field keys, choice values and flags are preserved. A result cannot
replace a draft edited while translation was running. Discard and restore
controls keep review reversible.

Unlike the local interface catalog described above, this action sends editable
waiver text to Anthropic using the existing ANTHROPIC_API_KEY. It does not send
participant submissions. The endpoint enforces membership, template ownership,
editor permissions, active trial/subscription, origin and input limits.
Limits: 30,000 characters, 250 text sections, 100-second provider timeout.
Review translations before publishing; AI translation is not legal review.

Full-document translation supports English, French, Spanish, Portuguese,
Chinese, Hindi, Bengali and Russian. Arabic and Urdu remain interface-only:
the installed PDF renderer fails on some Arabic-script diacritics. The editor
and API block these full-document targets, and reject Arabic-script output.
Local Noto fonts support the other scripts in signed PDFs.

This creates one translated document, not parallel language versions. Changing
the public interface selector does not translate published legal content.
No additional migration beyond 0020 is required.

Verification:
- node --experimental-strip-types scripts/verify-waiver-translation.mjs
- node scripts/verify-translated-pdf.mjs
- node --experimental-strip-types scripts/verify-signer-language.mjs
- node scripts/verify-signer-language-publish.mjs

Provider responses are mocked in endpoint tests; live translation still needs
a configured-environment smoke test.
