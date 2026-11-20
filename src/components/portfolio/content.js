import { SITE } from '../site/site'

/* Everything the portfolio says lives here. Facts come from your resume
 * (public/Aadarsh_Choudhari_Resume_UIUX.pdf); lines marked DRAFT are my wording, check them. */

export const PROFILE = {
  name: SITE.name,
  first: 'Aadarsh',
  role: 'Product designer',
  location: 'Mumbai',
  email: SITE.email,
  resume: '', // put your resume PDF in public/ and its path here to show the Download button
  photo: '/hero/me.png',
  company: { name: 'VoloX', logo: '/hero/volox.svg' },
}

export const HERO = {
  // the last word rotates through `words`
  lead: 'I design products that make complex work feel',
  words: ['simple.', 'calm.', 'obvious.'],
  sub: 'Product designer in Mumbai, shaping EV mobility, enterprise dashboards and SaaS platforms for teams in the US and UK.',
}

export const ABOUT = {
  bio: [
    'I design digital products that balance what people need with what the business needs. My background is in computers (an MCA and a BSc in IT), so I design knowing how things get built.',
    'Since April 2025 I have been a UX designer at VoloX, working on EV parking and charging, enterprise dashboards and SaaS platforms. Before that I interned at iTEDIUM.',
  ],
  skills: ['UI/UX design', 'Design systems', 'User flows', 'Wireframing', 'Prototyping', 'AI-assisted design'],
  tools: ['Figma', 'Framer', 'Photoshop', 'Illustrator', 'Jira', 'Canva'],
  interests: ['Gaming', 'Travelling', 'Cooking', 'Chess', 'Digital art', 'Graphic design'],
  experience: [
    { org: 'VoloX Innovations', role: 'Jr. UX Designer', when: 'Apr 2025 - now' },
    { org: 'iTEDIUM', role: 'UX Designer Intern', when: 'Feb - Jul 2024' },
  ],
}

export const STATEMENT = {
  headline: 'You don’t have to buy your software anymore.',
  // DRAFT: supporting message
  body: 'Off-the-shelf tools make your team work their way. With good design and AI-assisted building, software can fit the way you already work, for an audience of one or a team of forty.',
  cta: 'Let’s design yours',
}

export const PROJECTS = [
  {
    id: 'ev',
    title: 'EV Parking & Charging Booking Platform',
    category: 'Product design',
    year: '2025',
    mark: 'EV',
    summary: 'A white-label EV booking experience: user flows, high-fidelity screens and scalable design-system components.',
    stack: ['Figma', 'Design systems', 'User flows'],
    tint: '#dbe6ff',
  },
  {
    id: 'rnd',
    title: 'R&D Tax Credit Management Platform',
    category: 'Enterprise SaaS',
    year: '2025',
    mark: 'R&D',
    summary: 'Dashboards and workflows that simplify documentation, compliance and tax-credit claim management.',
    stack: ['Figma', 'Dashboards', 'Prototyping'],
    tint: '#e4f2e8',
  },
  {
    id: 'ops',
    title: 'Operations Dashboards',
    category: 'Dashboards',
    year: '2025',
    mark: 'OPS',
    // DRAFT: summary
    summary: 'Operational views that turn busy data into the next decision, built on a shared component library.',
    stack: ['Figma', 'Jira', 'Design systems'],
    tint: '#f6ead7',
  },
  {
    id: 'itedium',
    title: 'iTEDIUM',
    category: 'Internship',
    year: '2024',
    mark: 'iT',
    // DRAFT: summary
    summary: 'Six months as a UX design intern: wireframes, prototypes and UI for client products.',
    stack: ['Figma', 'Wireframing', 'Prototyping'],
    tint: '#ece6f7',
  },
]

// DRAFT: all answers, edit freely
export const FAQ = [
  {
    id: 'work',
    q: 'What kind of work do you do?',
    a: 'Product design end to end: research and user flows, wireframes, high-fidelity UI, prototypes and the design system that keeps it consistent.',
  },
  {
    id: 'freelance',
    q: 'Are you available for freelance projects?',
    a: 'I work full time at VoloX, so I take on a small number of side projects. Tell me about yours and I will say honestly whether I can give it the time it needs.',
  },
  {
    id: 'devs',
    q: 'How do you work with developers?',
    a: 'Closely and early. I started in code, so I design with real constraints in mind and hand off components, states and edge cases, not just pretty screens.',
  },
  {
    id: 'remote',
    q: 'Do you work with teams outside India?',
    a: 'Yes. I work remotely with teams in the US and UK and plan around the time-zone overlap.',
  },
  {
    id: 'tools',
    q: 'Which tools do you use?',
    a: 'Mostly Figma and Framer, with Photoshop and Illustrator for visuals, Jira for planning and AI tools to explore ideas faster.',
  },
]

export const SOCIALS = [
  { label: 'Behance', href: SITE.behance },
  { label: 'Instagram', href: SITE.instagram },
  // add LinkedIn / Medium / Figma profile URLs here (they are on your resume)
]
