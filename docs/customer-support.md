# Customer support operations

The authenticated help center is `/help`. Sidebar, header, and command-palette
support links stay inside the app. Signed-in visitors to `/support` redirect
there; visitors without a session still see the public FAQ.

## What the app handles

- Searchable product answers, with links to the relevant app tools.
- Tawk.to chat opens in place. Availability comes from the widget API, never
  a hard-coded “online” badge. Connection failure offers the request form.
- Chat loads after existing cookie consent or an explicit Open chat click.
  Clicking chat does not grant analytics consent or send a message for the user.
- Public signer and kiosk routes hide the widget, including after app navigation.
- Email requests use the existing Resend integration and Turnstile protection.
  The reply-to address is the customer's chosen email. The verified signed-in
  email is included for the support team. Delivery failures are not reported as
  successful. A successful request displays the provider delivery reference.
- Switching contact methods keeps a request draft mounted. Requests are not a
  ticket database: the app does not claim to display a ticket history or status.

## Recommended Tawk.to dashboard setup

These are operator settings; they have **not** been enabled by this code change.

1. Set the widget color to the app's purple and use “FlatWaiver support” as the
   display name. Disable the large attention-grabber graphic for a quieter UI.
2. Set working hours to hours you can cover. Use the offline form to collect a
   reply email. Suggested offline copy: “We're away right now. Tell us what you
   need and leave your email so we can follow up.”
3. Create four suggested messages: “Set up my first waiver”, “A customer can't
   sign”, “Billing question”, and “Find or export a signature”. Tawk supports up
   to four suggested messages per shortcut or trigger.
4. Create one help-page trigger scoped to `/help`, delayed by 30 seconds, once
   per visit. Suggested copy: “Need a hand? Tell us what you're trying to do.”
   Avoid triggers on signing and kiosk pages.
5. Save shortcuts for first-waiver setup, sharing a QR code, exports, billing,
   and collecting useful bug details. Base replies on `src/lib/support-faqs.ts`.
6. Use offline-message ticketing for follow-up and assign unresolved requests
   to a team member. Tawk ticketing and Resend form messages are separate inbox
   channels unless you configure email forwarding in your mail provider.
7. Consider the Tawk knowledge base once the help articles are ready. Keep any
   AI Assist purchase or automatic customer replies as a separate decision;
   this implementation does not enable paid services or automated messages.

## Verification

Run `npm run lint`, `npm run build`, `npm run verify:support-journey`, and
`node scripts/verify-support-chat.mjs`.

Manual production checks: open support from desktop and mobile app navigation;
search an answer; open chat after declining analytics; check an offline state;
switch between email and chat while drafting a request; submit a deliberate
support request and reply from the receiving mailbox. Do not send test messages
to real customers. Local/preview chat is disabled unless `NEXT_PUBLIC_TAWK_SRC`
explicitly points to an appropriate test widget.

Sources:
- https://developer.tawk.to/jsapi/
- https://help.tawk.to/article/intro-to-suggested-messages
- https://help.tawk.to/article/how-to-create-a-ticket
