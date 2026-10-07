export type Industry = {
  slug: string; label: string; seoTitle: string; title: string; description: string;
  audience: string; introduction: string; headline: string; scenario: string; scenarioTitle: string;
  steps: { title: string; text: string }[];
  sections: { title: string; paragraphs: string[] }[];
  checklistTitle: string; checklist: string[];
  criteriaTitle: string; criteria: { need: string; detail: string }[];
  guide: { href: string; label: string };
  faqs: { question: string; answer: string }[]; related: string[];
};

export const industries: Industry[] = [
  {
    "slug": "fitness-studios",
    "label": "Fitness studios",
    "title": "Gym Waiver Software for Fitness Studios and Personal Trainers",
    "description": "Collect gym and personal training waivers before the first workout. Use phone, QR or kiosk signing, then search and download the stored signed PDF.",
    "audience": "For personal trainers, bootcamps and coached fitness",
    "headline": "Keep the first workout focused on the client",
    "scenario": "A new client arrives while the coach is finishing the previous session. They need time to read your participation waiver, and the trainer needs to start the consultation without a clipboard changing hands. Send the signing link with your welcome instructions so the paperwork can be completed before that handover.",
    "scenarioTitle": "A trial session between appointments",
    "steps": [
      {
        "title": "Before the consultation",
        "text": "Include the link in the welcome message you send new clients."
      },
      {
        "title": "At the studio door",
        "text": "Offer a QR code for a drop-in who has not signed ahead."
      },
      {
        "title": "Before warm-up",
        "text": "Staff search for the record and apply the studio’s participation policy."
      }
    ],
    "sections": [
      {
        "title": "Different sessions deserve deliberate wording",
        "paragraphs": [
          "One-to-one training, outdoor bootcamps and small-group strength sessions can involve different activities. Keep separate templates when your adviser recommends different wording rather than stretching one generic document to cover every program.",
          "Give templates recognizable names so staff share the right link. Publishing revised wording creates a new version; it does not change a client’s earlier signed document."
        ]
      },
      {
        "title": "Fit signing around the coaching conversation",
        "paragraphs": [
          "Put a QR code at reception, away from the exercise floor. Clients can read on their own phones while the coach prepares the session. A tablet in kiosk mode helps visitors who need a device.",
          "Coaches still conduct their own suitability screening, explain equipment and record training notes through their existing process. A signed agreement does not clear a client for exercise."
        ]
      },
      {
        "title": "Youth training needs an adult’s attention",
        "paragraphs": [
          "Enable minors on the relevant waiver for young athletes. The form collects participant details plus a parent or guardian’s full name, relationship and signature.",
          "Send the link to the responsible adult before the appointment. The person booking may not have authority to sign; your team decides how to check that at arrival."
        ]
      }
    ],
    "faqs": [
      {
        "question": "Does signing replace health screening?",
        "answer": "No. Use your own intake process and qualified advice to decide whether a session is appropriate. A signature does not replace professional judgment or an emergency plan."
      },
      {
        "question": "Can we have separate outdoor bootcamp waivers?",
        "answer": "Yes. Create a separate reviewed template and distribute its published link. Staff should retrieve the appropriate waiver for that activity."
      },
      {
        "question": "Will this manage memberships and bookings?",
        "answer": "FlatWaiver handles signing and signed records. Add the link to messages you already send; bookings, membership and attendance remain in your existing tools."
      },
      {
        "question": "How do we check a returning client?",
        "answer": "Search records by name or email and filter by date or waiver. Download the stored PDF and follow your studio’s policy on whether a new signature is needed."
      }
    ],
    "related": [
      "yoga-studios",
      "martial-arts"
    ],
    "seoTitle": "Gym Waiver Software for Fitness Studios & Trainers",
    "introduction": "Bring your studio?s reviewed participation waiver online. Trial clients can sign before their first workout, drop-ins can use a reception QR code, and coaches can retrieve the signed record before the session.",
    "checklistTitle": "Test the first-client handoff during your trial",
    "checklist": [
      "Prepare the reviewed document for one real service: personal training, a studio class or an outdoor bootcamp. Check every converted paragraph against your original.",
      "Send the published link to a teammate acting as a new client. Test the form on a phone and confirm that the consent text is readable.",
      "Have a second teammate use kiosk mode as a walk-in. Complete the form and confirm it resets before the next visitor uses the device.",
      "Search for both sample records by name or email, open their PDFs and rehearse who checks paperwork before the consultation starts."
    ],
    "criteriaTitle": "Choosing waiver software for your training business",
    "criteria": [
      {
        "need": "A waiver for trial clients and drop-ins",
        "detail": "FlatWaiver gives you a public signing link, a printable QR code and kiosk mode. You choose when staff verify the completed record."
      },
      {
        "need": "Different documents for different services",
        "detail": "Unlimited templates let you separate coached sessions and bootcamps when your reviewed documents call for it."
      },
      {
        "need": "A complete gym-management platform",
        "detail": "If you need memberships, class payments and attendance automatically connected to waivers, evaluate an integrated system. FlatWaiver?s link-sharing workflow does not synchronize those records."
      }
    ],
    "guide": {
      "href": "/blog/gym-waiver-software",
      "label": "Gym waiver software buying checklist"
    }
  },
  {
    "slug": "yoga-studios",
    "label": "Yoga studios",
    "title": "Yoga Studio Waiver Software for Classes and Workshops",
    "description": "Collect yoga waivers before class or a specialist workshop. Share a signing link, offer a reception tablet and keep the exact signed document searchable.",
    "audience": "For yoga teachers and independent studios",
    "headline": "Let students settle in before practice begins",
    "scenario": "The evening class is filling up, shoes are coming off and a first-time student is trying to find a mat. Reading a participation waiver at the entrance competes with the quiet arrival you want to create. Share the form beforehand so students can take their time outside the class transition.",
    "scenarioTitle": "A first visit before an evening class",
    "steps": [
      {
        "title": "In the welcome note",
        "text": "Send the link alongside directions and what to bring."
      },
      {
        "title": "In the reception area",
        "text": "Keep a QR code accessible for students joining at short notice."
      },
      {
        "title": "Before entering the room",
        "text": "Look up the record without interrupting the teacher’s preparation."
      }
    ],
    "sections": [
      {
        "title": "Separate everyday classes from special events",
        "paragraphs": [
          "A weekly studio class, inversion workshop and off-site retreat may need different participation wording. Create distinct templates where appropriate and have the content reviewed for the activity you actually offer.",
          "Use the relevant link in each event’s instructions. Your team decides which terms apply; FlatWaiver does not assign students to classes or determine a retreat’s legal requirements."
        ]
      },
      {
        "title": "Keep paperwork outside the practice room",
        "paragraphs": [
          "Display the QR code near reception rather than asking students to use phones beside their mats. A kiosk tablet serves visitors who need a device and resets after a completed signature.",
          "For a visiting teacher’s workshop, share the link early and leave time for questions. Reading and agreeing should not be rushed by the class start time."
        ]
      },
      {
        "title": "Plan carefully for family and youth classes",
        "paragraphs": [
          "Enable minors when your program requires guardian signing. The form collects the young participant’s details and the parent or guardian’s name, relationship and signature.",
          "Give the responsible adult access in advance. Your studio remains responsible for age policies and checking who can provide consent."
        ]
      }
    ],
    "faqs": [
      {
        "question": "Can one waiver cover classes and a retreat?",
        "answer": "You control the wording, but those activities may have different needs. Ask your legal adviser whether separate templates are appropriate and share the correct link."
      },
      {
        "question": "Can students read before their first class?",
        "answer": "Yes. Copy the published link into the welcome message you send. Students can read and sign on their own device before arriving."
      },
      {
        "question": "Does signing replace discussing adaptations?",
        "answer": "No. Teachers still need their own process for discussing suitability, modifications and participation. FlatWaiver does not provide clinical or teaching advice."
      },
      {
        "question": "Can we retrieve an earlier workshop’s form?",
        "answer": "Yes. Search by name or email and filter by date or waiver. The stored PDF keeps the version signed at that time, even after template updates."
      }
    ],
    "related": [
      "fitness-studios",
      "surf-schools"
    ],
    "seoTitle": "Yoga Studio Waiver Software for Classes & Workshops",
    "introduction": "Give new students time to read your reviewed waiver before settling onto their mats. Share the form in your welcome message, offer QR or tablet signing at reception, and keep workshop records available after the event.",
    "checklistTitle": "Rehearse a first class and a workshop arrival",
    "checklist": [
      "Choose your reviewed studio document and a separate workshop document if needed. Check titles and consent text so students know which activity they are signing for.",
      "Place each signing link in the welcome message you normally send. Test that a student can reach the form without needing access to your class-booking account.",
      "Put the QR sign in reception and complete a kiosk test before the class transition. Check that the next student starts with an empty form.",
      "Retrieve a sample workshop record, then publish a wording update and confirm that the earlier stored PDF still contains the original version."
    ],
    "criteriaTitle": "A waiver workflow alongside your class schedule",
    "criteria": [
      {
        "need": "Pre-class reading on a student?s device",
        "detail": "Use the published link in your existing welcome messages. FlatWaiver collects the agreement online; your team chooses when to send it."
      },
      {
        "need": "Separate workshop and retreat paperwork",
        "detail": "Keep reviewed documents in distinct templates and retrieve records using waiver and date filters."
      },
      {
        "need": "Automatic class-pack or membership checks",
        "detail": "Those checks belong to your studio-management system. If they must be linked automatically to waiver completion, assess that integration requirement before choosing software."
      }
    ],
    "guide": {
      "href": "/blog/online-waivers",
      "label": "How online waiver collection works"
    }
  },
  {
    "slug": "trampoline-parks",
    "label": "Trampoline parks",
    "title": "Trampoline Park Waiver Software for Parties and Family Arrivals",
    "description": "Prepare trampoline party waivers before arrival. Collect guardian signatures, offer QR or kiosk signing and retrieve each participant?s stored signed record.",
    "audience": "For trampoline parks and indoor jump venues",
    "headline": "Get the paperwork ready before the party arrives",
    "scenario": "A birthday group reaches reception together, but not every child arrives with the adult who booked the party. Some parents have signed ahead; others still need to read the form. A waiver link in your party instructions gives each responsible adult a way to prepare before the queue forms.",
    "scenarioTitle": "A birthday party in the weekend rush",
    "steps": [
      {
        "title": "Before party day",
        "text": "Ask the organizer to share your link with parents and guardians."
      },
      {
        "title": "At family check-in",
        "text": "Offer QR signing to adults who still need to complete the form."
      },
      {
        "title": "Before the briefing",
        "text": "Staff check signed records against their own guest list."
      }
    ],
    "sections": [
      {
        "title": "Reach the adult who needs to sign",
        "paragraphs": [
          "Enable minors for young jumpers. The form captures participant details alongside a parent or guardian’s full name, relationship and signature.",
          "An organizer sharing the link is not providing consent for every guest. Follow your venue’s policy when a child arrives without a responsible adult or the required signed record."
        ]
      },
      {
        "title": "Give walk-ins a place to read",
        "paragraphs": [
          "Display a QR code where families can pause before the admission line. Visitors use their own phones, while a reception tablet in kiosk mode provides another signing option.",
          "The kiosk resets after a completed signature. Staff still verify records, issue admission items and deliver the safety briefing through the venue’s normal process."
        ]
      },
      {
        "title": "Keep wording appropriate to each attraction",
        "paragraphs": [
          "Open jumping, special sessions and additional attractions may need different wording. Prepare reviewed templates that describe your actual activities and make it clear which link staff should distribute.",
          "After changing an attraction, publish revised wording as a new version. Existing signed records retain their original wording rather than adopting today’s template."
        ]
      }
    ],
    "faqs": [
      {
        "question": "Does a party link sign every child in?",
        "answer": "No. Sharing it gives families access to the form. Your team still checks that the required participant and guardian records exist and handles admission separately."
      },
      {
        "question": "Can a parent sign before dropping a child off?",
        "answer": "Yes. With minors enabled, the responsible adult can complete the guardian section online. Your venue decides what additional checks or permissions are needed at drop-off."
      },
      {
        "question": "Will FlatWaiver issue tickets or wristbands?",
        "answer": "No automatic admission workflow is promised. Use your existing ticketing process and have staff search signed records at check-in."
      },
      {
        "question": "Can we find records from last month’s party?",
        "answer": "Yes. Search by participant name or email, filter by date or waiver and download the matching stored PDF."
      }
    ],
    "related": [
      "climbing-gyms",
      "paintball"
    ],
    "seoTitle": "Trampoline Park Waiver Software for Family Arrivals",
    "introduction": "Share your park?s waiver with families before party day. Collect participant and guardian details, give walk-ins a QR or tablet option, and let reception retrieve the signed records before completing admission.",
    "checklistTitle": "Test the arrivals that cause party-day exceptions",
    "checklist": [
      "Review your park document and enable minors. Complete a sample form with a young participant and guardian, then inspect the stored PDF for both sets of details.",
      "Ask a teammate acting as a party organizer to forward the link. Have another adult sign so you can check that distributing a link and providing consent remain separate tasks.",
      "Rehearse a late guest with a missing record. Confirm who contacts the required guardian and who checks the completed record against your separate guest list.",
      "Test QR signing and a kiosk reset at reception before you use the flow during a party. Keep ticketing, attraction rules and admission decisions in your normal process."
    ],
    "criteriaTitle": "Check the family workflow before selecting a platform",
    "criteria": [
      {
        "need": "Guardian details with a young jumper?s record",
        "detail": "Enable minors to capture participant details and the adult?s name, relationship and signature. Your team verifies authority and arrival requirements."
      },
      {
        "need": "A busy-lobby signing option",
        "detail": "Families can use their own phones from your QR code or a tablet in kiosk mode. All submissions require internet access."
      },
      {
        "need": "Party rosters linked to ticket purchases",
        "detail": "FlatWaiver does not automatically match signatures to tickets or issue wristbands. If linked party invitations and entry control are essential, evaluate a platform with those capabilities."
      }
    ],
    "guide": {
      "href": "/blog/electronic-signature-waiver",
      "label": "What a digital signature record contains"
    }
  },
  {
    "slug": "axe-throwing",
    "label": "Axe throwing",
    "title": "Axe Throwing Waiver Software for Lanes and Group Events",
    "description": "Collect axe throwing waivers before the lane briefing. Share links with group attendees, offer QR signing for walk-ins and retrieve stored signed PDFs.",
    "audience": "For axe throwing venues and lane hosts",
    "headline": "Start the lane briefing with paperwork checked",
    "scenario": "A corporate group arrives after dinner and wants to reach its reserved lanes. The organizer knows the schedule, but each attendee still needs to read and sign your waiver. Include the published link in the event instructions and ask the organizer to distribute it to participants.",
    "scenarioTitle": "A corporate group arriving for reserved lanes",
    "steps": [
      {
        "title": "With event instructions",
        "text": "Ask the organizer to distribute the link to attendees."
      },
      {
        "title": "Beside reception",
        "text": "Give late arrivals a QR code or tablet before they join a lane."
      },
      {
        "title": "Before handling axes",
        "text": "Staff check records and conduct the venue’s briefing."
      }
    ],
    "sections": [
      {
        "title": "Keep the briefing separate from the agreement",
        "paragraphs": [
          "Digital signing moves document reading earlier, but it does not demonstrate that a participant understands throwing rules. Hosts still explain lane boundaries, equipment and stop signals before play begins.",
          "Put the QR code in a waiting area where guests can read without holding equipment. Allow time for questions instead of treating a signature as the end of the safety conversation."
        ]
      },
      {
        "title": "Work with your existing event communication",
        "paragraphs": [
          "Copy the signing link into the confirmation messages your team sends. Give corporate organizers clear instructions to share it with attendees rather than collecting one signature on everyone’s behalf.",
          "Staff still manage lane reservations and compare records with their event list. FlatWaiver does not automatically synchronize bookings or attendee lists."
        ]
      },
      {
        "title": "Match the form to your admission policy",
        "paragraphs": [
          "Use wording reviewed for your activities and jurisdiction. If you admit minors, enable guardian signing and decide how staff will check age and adult authority.",
          "For an adults-only venue, keep the setup consistent with that rule. Capturing a signature does not verify age or replace identification checks."
        ]
      }
    ],
    "faqs": [
      {
        "question": "Can the organizer sign for everyone?",
        "answer": "Do not assume an organizer has that authority. Share the link so the required people can complete your reviewed consent process."
      },
      {
        "question": "Can walk-ins sign while waiting for a lane?",
        "answer": "Yes. They can open the published form from a QR code on their phone. Kiosk mode on your tablet is another option before the briefing."
      },
      {
        "question": "Does FlatWaiver check sobriety or age?",
        "answer": "No. Staff remain responsible for admission rules, identification checks and deciding whether someone can safely participate."
      },
      {
        "question": "What happens after our waiver wording changes?",
        "answer": "Earlier signatures retain the exact published version and stored PDF. New visitors sign the newly published version. Staff can retrieve either record."
      }
    ],
    "related": [
      "paintball",
      "climbing-gyms"
    ],
    "seoTitle": "Axe Throwing Waiver Software for Group Events",
    "introduction": "Get individual agreements ready before your lane hosts begin their briefing. Send the venue?s published form with event instructions, offer a reception QR code for late arrivals, and search the signed records when guests check in.",
    "checklistTitle": "Run a small group-event rehearsal",
    "checklist": [
      "Publish your reviewed venue document and check it on a phone. Keep participation terms and your separate lane instructions clear to guests.",
      "Send the link to a teammate acting as the organizer, then have several attendees complete their own required signing process. Compare names with your event list.",
      "Rehearse a late arrival using the reception QR code and a visitor who needs the kiosk tablet. Confirm where they wait while reading.",
      "Look up a completed record and download its PDF. Have a lane host explain the handoff from paperwork checks to admission checks and the safety briefing."
    ],
    "criteriaTitle": "Decide how much event automation you need",
    "criteria": [
      {
        "need": "An agreement before the event",
        "detail": "Copy your published signing link into the communications you send the organizer or individual guests."
      },
      {
        "need": "A retrievable record after the session",
        "detail": "Search by name or email, filter by date or waiver and download the stored PDF tied to the signed version."
      },
      {
        "need": "Booking-linked invitations and completion counts",
        "detail": "FlatWaiver does not promise automatic lane-booking synchronization or pending-attendee rosters. If those are requirements, compare integrated event platforms."
      }
    ],
    "guide": {
      "href": "/blog/waiver-software-cost",
      "label": "Compare waiver pricing models and requirements"
    }
  },
  {
    "slug": "paintball",
    "label": "Paintball fields",
    "title": "Paintball Waiver Software for Fields and Private Games",
    "description": "Collect paintball waivers before equipment handover. Prepare guardian signatures, offer phone or kiosk signing and search signed records after game day.",
    "audience": "For paintball fields and private-game operators",
    "headline": "Clear the paperwork before equipment handover",
    "scenario": "A private group arrives alongside the first open-play players. Staff are checking attendance, preparing rental gear and organizing the briefing. Send the waiver link with arrival instructions so reading and signing can happen before those jobs converge at the equipment counter.",
    "scenarioTitle": "Private games meeting the open-play queue",
    "steps": [
      {
        "title": "Before game day",
        "text": "Include the link with field directions and arrival times."
      },
      {
        "title": "At the staging area",
        "text": "Offer a QR code to players who have not signed."
      },
      {
        "title": "Before collecting gear",
        "text": "Staff retrieve records and complete admission checks."
      }
    ],
    "sections": [
      {
        "title": "Prepare youth players before they reach the field",
        "paragraphs": [
          "When minors are allowed, enable the guardian option and share the link with responsible adults ahead of the visit. The form collects participant details and the adult’s name, relationship and signature.",
          "A team captain distributing instructions does not automatically have signing authority. Decide how staff handle missing guardian consent before equipment is issued."
        ]
      },
      {
        "title": "Choose a practical signing location",
        "paragraphs": [
          "Keep the QR sign near reception or staging, where players can read before gloves and equipment make phone use inconvenient. A kiosk tablet helps visitors who need a device.",
          "Both options need internet access. Plan a staffed process for connectivity problems rather than assuming a signature can be submitted offline."
        ]
      },
      {
        "title": "Keep agreements distinct from field rules",
        "paragraphs": [
          "Prepare wording for the activities and equipment you actually use. If you offer separate formats or youth sessions, ask your adviser whether they need distinct templates.",
          "Marshals still deliver briefings and enforce field rules. A stored record documents the agreement; it is not proof that a player followed instructions throughout a game."
        ]
      }
    ],
    "faqs": [
      {
        "question": "Can we keep separate game-format waivers?",
        "answer": "Yes. Unlimited templates let you keep distinct reviewed documents where appropriate. Name them clearly and share the link for the activity being played."
      },
      {
        "question": "Can parents complete the form from home?",
        "answer": "Yes. Enable minors and share the link so a parent or guardian can provide their name, relationship and signature before arrival."
      },
      {
        "question": "Will signing work without reception at the field?",
        "answer": "Submitting a signature needs internet access. Check connectivity where players sign and encourage advance completion when service is limited."
      },
      {
        "question": "Can we retrieve private-event records later?",
        "answer": "Yes. Search by name or email and filter by waiver and date to download stored PDFs. Your event roster remains in the tools you already use."
      }
    ],
    "related": [
      "axe-throwing",
      "trampoline-parks"
    ],
    "seoTitle": "Paintball Waiver Software for Fields & Private Games",
    "introduction": "Prepare the paperwork before players queue for rental equipment. Use your field?s reviewed waiver, share it with private groups and open-play visitors, and check the signed record before your normal admission and briefing steps.",
    "checklistTitle": "Rehearse the staging-area handover",
    "checklist": [
      "Prepare the document for the game format you are testing. Compare the converted draft with the original and enable minors when the youth signing process requires it.",
      "Send a sample private-game arrival message with the link. Ask a teammate to complete it from home before reaching the field.",
      "Test QR and kiosk signing at the actual reception point. Check internet access and decide how staff handle a guest whose paperwork cannot be completed there.",
      "Find adult and guardian sample records, download their PDFs and rehearse the check before equipment is issued. Keep your guest roster and briefing checks separate."
    ],
    "criteriaTitle": "Evaluate software against your field?s arrival process",
    "criteria": [
      {
        "need": "Youth and adult participation forms",
        "detail": "Configure the appropriate minor flow and use separate reviewed templates where game formats require different wording."
      },
      {
        "need": "Records from earlier private games",
        "detail": "Use name or email search plus date and waiver filters. Updating a template does not rewrite an older signed PDF."
      },
      {
        "need": "Offline signing or an automated game roster",
        "detail": "FlatWaiver?s signing flow is online and does not synchronize an event list with completed signatures. Check those requirements before moving from your current system."
      }
    ],
    "guide": {
      "href": "/blog/online-waivers",
      "label": "Prepare your existing paper waiver for online signing"
    }
  },
  {
    "slug": "kayak-rentals",
    "label": "Kayak rentals",
    "title": "Kayak Rental Waiver Software for Paddling Outfitters",
    "description": "Collect kayak, canoe and paddleboard rental waivers before launch. Share signing links, capture guardian details and retrieve the exact signed PDF later.",
    "audience": "For kayak, canoe and paddleboard rental teams",
    "headline": "Have the agreement ready before the launch window",
    "scenario": "Several paddlers arrive while staff fit buoyancy aids and move boats to the water. The rental lead still needs to check everyone’s required agreement. Send the signing link with the launch location and arrival instructions so guests can read before reaching the shore.",
    "scenarioTitle": "A morning launch with several rental parties",
    "steps": [
      {
        "title": "Before departure",
        "text": "Send the link with directions to the desk and launch point."
      },
      {
        "title": "At the rental desk",
        "text": "Offer QR signing before guests stow their phones."
      },
      {
        "title": "Before launching",
        "text": "Staff check records, equipment and water conditions."
      }
    ],
    "sections": [
      {
        "title": "Separate signing from rental administration",
        "paragraphs": [
          "Your operation still needs its own process for bookings, deposits, equipment allocation and returns. Share the published waiver link through the communications you already use.",
          "FlatWaiver does not reserve a boat or confirm a launch slot. Staff compare signed records with the rental party and resolve missing paperwork before handover."
        ]
      },
      {
        "title": "Finish while devices are accessible",
        "paragraphs": [
          "Place the QR code at the desk rather than the water’s edge. Guests can sign before putting phones into dry bags; a kiosk tablet provides another option.",
          "Check the internet connection at the signing location. For remote launches, encourage completion before travel and establish a process for guests whose records cannot be checked on site."
        ]
      },
      {
        "title": "Plan for families and different activities",
        "paragraphs": [
          "Enable minors when family rentals require guardian signatures. The form collects the child’s details plus the responsible adult’s full name, relationship and signature.",
          "Ask your adviser whether self-guided rentals and guided trips need different wording. Publish the relevant version for each activity while preserving earlier signed records."
        ]
      }
    ],
    "faqs": [
      {
        "question": "Does signing confirm someone can paddle safely?",
        "answer": "No. Staff still assess suitability, explain equipment, review conditions and apply the launch policy. A signature is not a skills assessment."
      },
      {
        "question": "Can guests sign before a remote launch?",
        "answer": "Yes. Share the link before travel so they can sign where they have internet access. Submitting signatures and checking records are online workflows."
      },
      {
        "question": "Can we include our rental terms?",
        "answer": "You control the text and fields. Have the complete document reviewed and check the published form. FlatWaiver does not manage deposits or enforce terms automatically."
      },
      {
        "question": "How do we retrieve a past rental’s record?",
        "answer": "Search by name or email and filter by date or waiver. Download the stored signed PDF with the version agreed to on that visit."
      }
    ],
    "related": [
      "surf-schools",
      "horseback-riding"
    ],
    "seoTitle": "Kayak Rental Waiver Software for Paddling Outfitters",
    "introduction": "Move agreement reading to a place where paddlers have a dry device and internet access. Share your reviewed rental waiver before travel, offer QR signing at the desk, and keep signed records available after the boats return.",
    "checklistTitle": "Test the flow at the launch location",
    "checklist": [
      "Prepare your reviewed rental document and check its fields. Distinguish self-guided rentals from guided outings if your adviser requires separate wording.",
      "Send the signing link with arrival directions and test it from a guest?s phone before travel. Do not rely on launch-point connectivity without checking it.",
      "Test QR signing and record lookup at your actual desk. Decide where guests complete the form before putting phones in dry bags.",
      "Retrieve an adult and, where applicable, guardian sample record. Verify the handoff to your own equipment, deposit and launch-readiness checks."
    ],
    "criteriaTitle": "Choose around connectivity and rental administration",
    "criteria": [
      {
        "need": "Pre-arrival agreements for paddlers",
        "detail": "Guests use your shared online link. At the desk, a QR code or kiosk tablet offers a second route to the same published form."
      },
      {
        "need": "Predictable pricing as launch traffic changes",
        "detail": "The monthly plan includes unlimited signed waivers. Compare your expected operating-season use with the total cost of any other pricing model."
      },
      {
        "need": "Offline submission, deposits or boat allocation",
        "detail": "FlatWaiver needs internet access and does not manage rental inventory, payments or launch slots. Evaluate those needs in your rental system."
      }
    ],
    "guide": {
      "href": "/blog/switch-from-smartwaiver",
      "label": "Plan a switch without losing access to older records"
    }
  },
  {
    "slug": "surf-schools",
    "label": "Surf schools",
    "title": "Surf School Waiver Software for Lessons and Camps",
    "description": "Collect surf lesson and camp waivers before the beach briefing. Prepare guardian signing, use a desk QR code and retrieve stored signed records later.",
    "audience": "For surf coaches, lesson desks and seasonal schools",
    "headline": "Give the beach briefing your students’ attention",
    "scenario": "A beginner lesson meets near the beach while instructors sort wetsuits and boards and students arrive from different directions. Sending the waiver link beforehand lets students read on a comfortable device instead of handling paperwork with sandy hands just before the briefing.",
    "scenarioTitle": "A beginner lesson assembling near the beach",
    "steps": [
      {
        "title": "In lesson instructions",
        "text": "Share the link with the meeting point and what to bring."
      },
      {
        "title": "At the lesson desk",
        "text": "Offer a QR code or tablet for unfinished paperwork."
      },
      {
        "title": "Before leaving for the beach",
        "text": "Staff check records and begin the usual briefing."
      }
    ],
    "sections": [
      {
        "title": "Make youth consent a pre-arrival task",
        "paragraphs": [
          "Enable minors for children’s lessons and send the link to parents or guardians. The form collects participant details with the adult’s name, relationship and signature.",
          "Ask families to complete it before the meet-up. Instructors still follow your policy for checking adult authority and dealing with missing consent."
        ]
      },
      {
        "title": "Keep signing out of the surf zone",
        "paragraphs": [
          "Place the QR code at a staffed lesson desk where students can pause to read. A kiosk tablet serves students without a suitable phone and resets after a completed signature.",
          "Test connectivity at the actual meeting location. Encourage advance signing when lessons start somewhere with unreliable internet service."
        ]
      },
      {
        "title": "Review the form when programs change",
        "paragraphs": [
          "A taster lesson, multi-day course and surf camp may need different documents. Use reviewed wording for each activity and name templates clearly so instructors distribute the correct link.",
          "Publish revised wording as a new version for the next season. Earlier lesson records keep their signed wording and stored PDF."
        ]
      }
    ],
    "faqs": [
      {
        "question": "Does signing replace water-safety checks?",
        "answer": "No. Coaches remain responsible for suitability, conditions, supervision and briefings. FlatWaiver does not evaluate swimming ability or weather."
      },
      {
        "question": "Can parents sign before a children’s camp?",
        "answer": "Yes. Enable minors and share the link with the responsible adult. Your school determines the consent wording and additional camp permissions."
      },
      {
        "question": "Is the link added to lesson confirmations automatically?",
        "answer": "You add it to the messages or confirmations you already send. FlatWaiver does not promise automatic booking integration or scheduling."
      },
      {
        "question": "Can staff find last season’s form?",
        "answer": "Authorized staff can search by name or email and filter by date or waiver, then download the stored PDF. Later edits do not overwrite it."
      }
    ],
    "related": [
      "kayak-rentals",
      "yoga-studios"
    ],
    "seoTitle": "Surf School Waiver Software for Lessons & Camps",
    "introduction": "Let students and guardians complete your reviewed form before wetsuits, boards and the beach briefing need their attention. Share the link with lesson instructions and give unfinished arrivals a signing option at your desk.",
    "checklistTitle": "Rehearse a lesson with a late arrival",
    "checklist": [
      "Prepare the reviewed lesson document and, if needed, a separate camp template. Check that instructors can recognize and distribute the correct published link.",
      "Send the link to an adult student and to a teammate testing guardian signing for a young learner. Review both completed PDFs.",
      "Use a phone and kiosk tablet at the meeting point to test connectivity. Decide who assists a student still signing while instructors prepare equipment.",
      "Search the sample records before the group leaves for the beach. Then rehearse the separate handoff to suitability checks and the water-safety briefing."
    ],
    "criteriaTitle": "Select a waiver tool for your lesson meet-up",
    "criteria": [
      {
        "need": "Parent signatures before a children?s lesson",
        "detail": "Enable minors and send the published link to the responsible adult. Your school determines any additional camp permissions."
      },
      {
        "need": "An earlier season?s signed document",
        "detail": "Search by participant name or email and date or waiver. The stored PDF retains the version signed during that lesson."
      },
      {
        "need": "Lesson scheduling and automatic booking delivery",
        "detail": "You share FlatWaiver links in your existing messages. It does not automatically schedule lessons or attach completed waivers to a booking record."
      }
    ],
    "guide": {
      "href": "/blog/electronic-signature-waiver",
      "label": "Understand the electronic waiver signing workflow"
    }
  },
  {
    "slug": "horseback-riding",
    "label": "Horseback riding",
    "title": "Horseback Riding Waiver Software for Lessons and Trails",
    "description": "Collect riding lesson and trail waivers before mounting. Capture guardian signatures, offer QR signing at the yard and retrieve stored signed PDFs.",
    "audience": "For riding schools, lesson yards and trail operators",
    "headline": "Finish the agreement before the horse is brought out",
    "scenario": "A first-time rider arrives as the previous lesson ends. Staff are preparing tack and meeting the next rider while a parent needs to read the youth document. Send the waiver link with your arrival instructions so that conversation does not begin beside a waiting horse.",
    "scenarioTitle": "A first lesson during the yard changeover",
    "steps": [
      {
        "title": "Before the appointment",
        "text": "Send the link with parking and arrival instructions."
      },
      {
        "title": "At the office",
        "text": "Offer QR signing or a tablet away from the horses."
      },
      {
        "title": "Before mounting",
        "text": "Staff check records, rider suitability and equipment."
      }
    ],
    "sections": [
      {
        "title": "Give guardians time before junior lessons",
        "paragraphs": [
          "Enable minors to collect the young rider’s details and a parent or guardian’s name, relationship and signature. Share the link before the first lesson so the adult has time to read.",
          "Your yard decides how to verify authority and handle a rider arriving with another adult. The form captures information; it does not establish legal authority to consent."
        ]
      },
      {
        "title": "Use the right document for lessons and trails",
        "paragraphs": [
          "Arena lessons, trail rides and holiday programs may raise different participation questions. Prepare reviewed templates for your actual activities and give staff a clear way to choose the link.",
          "Keep scheduling and rider allocation in your existing tools. Signing does not book a horse, assess experience or approve a rider for a trail."
        ]
      },
      {
        "title": "Keep records beyond the current season",
        "paragraphs": [
          "Publish revised wording as a new version. Each signed record remains attached to the version agreed to at signing, with its stored PDF available for retrieval.",
          "Search by name or email and narrow by date or waiver. Staff can locate a previous lesson’s document without replacing it with the form currently used at the yard."
        ]
      }
    ],
    "faqs": [
      {
        "question": "Does signing assess riding ability?",
        "answer": "No. Staff still discuss experience, choose suitable horses, check equipment and apply participation policies. A signature does not perform those assessments."
      },
      {
        "question": "Can parents sign before the first lesson?",
        "answer": "Yes. With minors enabled, the form collects participant details and the adult’s name, relationship and signature. Your yard determines consent and arrival checks."
      },
      {
        "question": "Will signing work with limited connectivity?",
        "answer": "Signing and record lookup need internet access. Encourage completion before travel and check connectivity at the office before relying on QR or kiosk signing."
      },
      {
        "question": "Does PDF conversion make our waiver legally suitable?",
        "answer": "No. Conversion produces an editable draft, not legal review. Compare it with your original, correct issues and seek qualified counsel for your activities and jurisdiction."
      }
    ],
    "related": [
      "kayak-rentals",
      "fitness-studios"
    ],
    "seoTitle": "Horseback Riding Waiver Software for Lessons & Trails",
    "introduction": "Prepare the agreement before riders reach a waiting horse. Share your stable?s reviewed document with lesson or trail instructions, give guardians time to read, and keep the signed record accessible to staff at the office.",
    "checklistTitle": "Rehearse the office-to-instructor handoff",
    "checklist": [
      "Choose the reviewed form for an arena lesson or trail ride. Check that the activity, participant details and consent text match the document you intend riders to sign.",
      "Complete sample adult and junior-rider forms. Inspect the guardian details in the youth record and decide how staff verify signing authority.",
      "Test phone and kiosk signing in the office, away from horse handling. Confirm connectivity and that a completed kiosk form resets.",
      "Have an instructor find a sample record before the mounting checks. Publish a revised version and verify that the earlier signed PDF remains available with its original wording."
    ],
    "criteriaTitle": "Match the software to your yard?s workflow",
    "criteria": [
      {
        "need": "Consent before a junior rider?s lesson",
        "detail": "The minor flow captures the participant?s details and guardian name, relationship and signature. Your yard applies its own authority and arrival checks."
      },
      {
        "need": "Different lesson and trail documents",
        "detail": "Prepare distinct templates with reviewed wording. Earlier signatures keep their published version after you update an agreement."
      },
      {
        "need": "Horse allocation or rider-level approval",
        "detail": "Those decisions remain with your staff and scheduling process. FlatWaiver does not assess experience, allocate horses or decide trail eligibility."
      }
    ],
    "guide": {
      "href": "/blog/are-digital-waivers-legally-binding",
      "label": "Electronic signatures and waiver enforceability are different questions"
    }
  }
];

export const industryDirectory = [
  { slug: "climbing-gyms", label: "Climbing gyms", description: "Prepare day-pass, youth and group arrivals before the first climb." },
  { slug: "martial-arts", label: "Martial arts", description: "Collect trial-student and guardian signatures before class starts." },
  ...industries,
];
