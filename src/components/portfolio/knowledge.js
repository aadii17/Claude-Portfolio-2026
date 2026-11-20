import { SITE } from '../site/site.js'

/* What the FAQ's ask box can answer. A visitor's question is matched against these entries
 * (answer.js): the entry whose question and keywords best fit wins, and its answer shows.
 * No AI and no server: it all runs in the visitor's browser, and nothing they ask is saved.
 * The FAQ's own questions (content.js) are matched too, so there's no need to repeat them here.
 *
 * To add one: copy an entry, write the question the way people would ask it, the answer you'd
 * give, and a few `keywords`: the words someone might use for it (single words work best).
 *
 * DRAFT: written from your resume and the site; check every answer. */

const PHONE = SITE.phone.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2')

export const QA = [
  {
    q: 'Who is Aadarsh?',
    a: 'Aadarsh Choudhari is a product designer (UI/UX) based in Mumbai, India. He designs EV parking and charging products, enterprise dashboards and SaaS platforms, currently at VoloX.',
    keywords: ['who', 'about', 'yourself', 'introduce', 'aadarsh', 'bio', 'summary'],
  },
  {
    q: 'Where does he work?',
    a: 'Since April 2025 he has been a Jr. UX Designer at VoloX Innovations. Before that he was a UX Design Intern at iTEDIUM, from February to July 2024.',
    keywords: ['work', 'job', 'company', 'employer', 'current', 'volox', 'experience', 'itedium', 'intern', 'internship', 'career', 'years'],
  },
  {
    q: 'Where is he based?',
    a: 'Mumbai, India. He works remotely with teams in the US and UK.',
    keywords: ['based', 'live', 'lives', 'located', 'location', 'city', 'mumbai', 'india', 'from', 'place'],
  },
  {
    q: 'What did he study?',
    a: 'Computers: a BSc in IT, then an MCA. So he designs knowing how things get built.',
    keywords: ['study', 'education', 'degree', 'college', 'university', 'mca', 'bsc', 'qualification', 'background'],
  },
  {
    q: 'What tools does he use?',
    a: 'Mostly Figma and Framer, with Photoshop and Illustrator for visuals, Jira for planning, Canva, and AI tools to explore ideas faster.',
    keywords: ['tool', 'tools', 'software', 'figma', 'framer', 'photoshop', 'illustrator', 'jira', 'canva', 'stack', 'app'],
  },
  {
    q: 'What are his skills?',
    a: 'UI/UX design, design systems, user flows, wireframing, prototyping and AI-assisted design.',
    keywords: ['skill', 'skills', 'good', 'expertise', 'strength', 'services', 'offer', 'speciality', 'specialty'],
  },
  {
    q: 'What projects has he worked on?',
    a: 'An EV parking and charging booking platform, an R&D tax credit management platform, operations dashboards, and client products during his internship at iTEDIUM.',
    keywords: ['project', 'projects', 'portfolio', 'case', 'study', 'worked', 'built', 'designed', 'clients', 'ev', 'dashboard', 'saas'],
  },
  {
    q: 'What is his design process?',
    a: 'He starts by understanding the users and the business goal, maps the user flows, sketches wireframes, then moves to high-fidelity UI and prototypes, and builds the design system that keeps it all consistent.',
    keywords: ['process', 'approach', 'method', 'workflow', 'steps', 'research'],
  },
  {
    q: 'Is he available for freelance work?',
    a: `He works full time at VoloX, so he takes on a small number of side projects. Email him about yours at ${SITE.email} and he will say honestly whether he can give it the time it needs.`,
    keywords: ['freelance', 'available', 'availability', 'hire', 'hiring', 'side', 'project', 'contract', 'collaborate', 'collaboration', 'work', 'together'],
  },
  {
    q: 'Is he open to full-time roles?',
    a: `He is happy to hear about roles that are a good fit. Email him the details at ${SITE.email}.`, // DRAFT
    keywords: ['full', 'time', 'fulltime', 'job', 'role', 'position', 'opening', 'opportunity', 'recruit', 'recruiter', 'hire', 'open'],
  },
  {
    q: 'How much does he charge?',
    a: `It depends on the scope of the project. Email him what you need at ${SITE.email} and he will send an estimate.`,
    keywords: ['charge', 'price', 'pricing', 'rate', 'rates', 'cost', 'fee', 'fees', 'budget', 'quote', 'estimate', 'expensive'],
  },
  {
    q: 'How does he work with developers?',
    a: 'Closely and early. He started in code, so he designs with real constraints in mind and hands off components, states and edge cases, not just screens.',
    keywords: ['developer', 'developers', 'dev', 'engineer', 'engineers', 'handoff', 'code', 'coding', 'build'],
  },
  {
    q: 'Does he work with teams outside India?',
    a: 'Yes. He works remotely with teams in the US and UK and plans around the time-zone overlap.',
    keywords: ['remote', 'remotely', 'outside', 'international', 'abroad', 'timezone', 'time', 'zone', 'uk', 'usa', 'america', 'global', 'country'],
  },
  {
    q: 'How do I contact him?',
    a: `Email ${SITE.email} or call ${PHONE}. He usually replies within a day or two.`,
    keywords: ['contact', 'reach', 'email', 'mail', 'phone', 'number', 'call', 'message', 'touch', 'connect', 'talk'],
  },
  {
    q: 'How fast does he reply?',
    a: 'Usually within a day or two by email.',
    keywords: ['reply', 'respond', 'response', 'fast', 'quick', 'soon', 'long', 'wait'],
  },
  {
    q: 'Where can I see more of his work?',
    a: `On Behance (${SITE.behance}), Instagram (${SITE.instagram}) and LinkedIn (${SITE.linkedin}).`,
    keywords: ['behance', 'instagram', 'social', 'more', 'see', 'link', 'links', 'profile', 'dribbble', 'linkedin'],
  },
  {
    q: 'Can I see his resume?',
    a: `His full experience is on LinkedIn (${SITE.linkedin}), or email him at ${SITE.email} and he will send his CV.`,
    keywords: ['resume', 'cv', 'download'],
  },
  {
    q: 'What does he do outside work?',
    a: 'Gaming, travelling, cooking, chess, digital art and graphic design.',
    keywords: ['hobby', 'hobbies', 'fun', 'free', 'outside', 'interest', 'interests', 'enjoy', 'like', 'weekend', 'personal'],
  },
  {
    q: 'What languages does he speak?',
    a: 'English and Hindi.', // DRAFT: add Marathi or others if you speak them
    keywords: ['language', 'languages', 'speak', 'english', 'hindi'],
  },
  {
    q: 'Hi!',
    a: 'Hi! Ask anything about Aadarsh: his work, projects, tools, availability or how to reach him.',
    keywords: ['hi', 'hello', 'hey', 'hii', 'namaste', 'yo', 'sup'],
  },
]

// when nothing fits
export const NO_MATCH = `I don’t have an answer for that one yet. Email Aadarsh at ${SITE.email} and he’ll reply himself.`
