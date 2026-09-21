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
authored. Edit those directly in the editor when a translated document is needed.
Field keys, option values, flags and submitted answers remain unchanged.

Consent is legal content, not an interface label. It is displayed verbatim from
the immutable published version and the same text is saved in the signature
snapshot and PDF. When French is selected and the consent still exactly matches
FlatWaiver's English default, **Use French translation of default consent** fills
the draft textarea. Review it before publishing. Custom consent is never
replaced. Other-language consent can be authored manually; it is not translated
by changing the interface selector. The PDF renderer's existing font coverage
is a separate limitation for non-Latin document content; this update does not
claim multilingual legal-document/PDF support or automatic legal translation.

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
need to be supplied and reviewed. No API key is needed for the current setup.
