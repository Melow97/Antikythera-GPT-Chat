# The Antikythera mechanism landing page

## What it does

The homepage hero is now an actual working mechanism illustration, built from three
mathematically-generated gear shapes (16/12/8 teeth, proper alternating tooth geometry —
not hand-drawn approximations) plus two orbital rings with satellite markers.

- **Gears rotate continuously**, and mesh realistically: the large gear spins one direction,
  the medium gear spins the opposite direction (like real meshing gears do), and the small
  gear — being smaller — spins fastest of the three, same as real gear ratios. Scrolling
  temporarily speeds all three up, so the mechanism visibly "reacts" as you move down the
  page, then settles back to its slow idle spin.
- **Orbital rings start slightly loose/rotated** and **snap into aligned position** as you
  scroll down through the hero — a "locking in" moment rather than a static decoration.
- **"Start Chat" sits in the center of the gear**, not as a separate button below it. Click
  it and a bronze iris-wipe expands outward from that exact point — the gear "opening" —
  before landing on the real Google sign-in redirect underneath. It's a transition effect
  layered on top of the actual sign-in flow, not a replacement for it.
- **Every other panel** (the app preview frame, feature cards, solution cards) fades and
  settles into place with a slight overshoot as you scroll to them — reads as parts
  clicking into position rather than a plain fade-in.
- Respects `prefers-reduced-motion` — all of the above becomes static for anyone with that
  OS/browser setting on.

## GitHub link + open-source section

- Added to the **top nav** (small link with the GitHub mark)
- A **new "Built in the open" section** on the page, with a full-width CTA button
- And again in the **footer**

I wrote the open-source blurb myself rather than reusing FreedomGPT's wording — reusing
their exact text would be a copyright problem, and honestly your project's positioning
(a configurable Ollama-based chat platform with connections and custom sections) is
different enough from theirs that it's worth its own framing anyway. Feel free to edit the
tone further — this is a first pass, not gospel.

## What I actually tested

Not just visual review — I ran this through a headless browser test:
- Confirmed all three gears rotate continuously, in alternating directions, at different
  speeds (large: slow/positive, medium: faster/negative, small: fastest/positive)
- Confirmed the orbital ring rotation goes from 22° (loose) to 0° (aligned) as scroll
  position moves through the hero, and the "aligned" state class applies correctly
- Confirmed all 14 `.reveal` panels get their "revealed" state applied via
  IntersectionObserver
- Confirmed clicking "Start Chat" adds the iris-wipe class, sets the wipe's origin point
  to the button's actual screen position, and — after the transition — actually attempts
  to navigate to `/login/google/start`, the real sign-in route (nothing was faked here;
  the visual effect sits on top of the genuine auth flow)
- Confirmed all three GitHub links are present and point to
  `https://github.com/Melow97/Antikythera-GPT-Chat`

## Files touched
`public/landing.html`, `public/landing.css`, `public/landing.js` — the app itself
(`public/app/*`) wasn't touched.
