// Your details. Edit here.
export const SITE = {
  name: 'Aadarsh Choudhari',
  email: 'hello@example.com', // your contact email (shown inside the phone)
  year: 2026,
  role: 'Product designer · Mumbai', // line under the lock-screen clock
  // lock-screen buttons: Behance bottom-left, Instagram bottom-right. Put your profile URLs here.
  behance: 'https://www.behance.net/', // e.g. 'https://www.behance.net/yourname'
  instagram: 'https://www.instagram.com/', // e.g. 'https://www.instagram.com/yourname'
}

// Lock-screen notifications (tapping one unfolds the phone). The phone (Flip) shows only the first.
// Add `image: '/work/xyz.jpg'` (in public/) to replace the tinted tile with a thumbnail.
export type Notice = { title: string; meta: string; image?: string }
export const NOTICES: Notice[] = [
  { title: 'EV Parking & Charging', meta: 'Product design · 2025' },
  { title: 'R&D Tax Credit Platform', meta: 'Enterprise SaaS · 2025' },
]
