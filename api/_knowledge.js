/* What the "Ask AI" assistant knows about you, on top of the site's own content (content.js,
 * site.js), which it also reads. Edit freely: add facts, add questions people might ask with the
 * answer you'd give. The assistant answers only from this file and the site, so anything not
 * here it will say it doesn't know (and point to your email).
 *
 * Nothing visitors ask is saved: questions and answers are not stored or logged anywhere.
 * (The leading _ keeps Vercel from treating this file as an API endpoint.)
 *
 * DRAFT: written from your resume and the site; check every line and change anything that's off. */

// facts about you, one per line, plain sentences
export const FACTS = [
  'Aadarsh Choudhari is a product designer (UI/UX) based in Mumbai, India.',
  'Since April 2025 he has worked as a Jr. UX Designer at VoloX Innovations.',
  'Before that he was a UX Designer Intern at iTEDIUM from February to July 2024.',
  'He studied computers: a BSc in IT and then an MCA. Because of that he designs knowing how things get built.',
  'He works on EV parking and charging, enterprise dashboards and SaaS platforms, for teams in the US and UK.',
  'He covers the whole product design process: research, user flows, wireframes, high-fidelity UI, prototypes and design systems.',
  'His main tools are Figma and Framer, plus Photoshop, Illustrator, Jira and Canva, and AI tools to explore ideas faster.',
  'Outside work he enjoys gaming, travelling, cooking, chess, digital art and graphic design.',
  'He speaks English and Hindi.', // DRAFT: check, add Marathi or others if you speak them
]

// questions visitors might ask, with the answer you'd give
export const QA = [
  {
    q: 'Is he available for freelance work?',
    a: 'He works full time at VoloX, so he takes on a small number of side projects. The best way to ask is to email him about the project, and he will say honestly whether he can give it the time it needs.',
  },
  {
    q: 'Is he open to full-time roles?',
    a: 'He is happy to hear about roles that are a good fit. Email him with the details.', // DRAFT
  },
  {
    q: 'How much does he charge?',
    a: 'It depends on the scope of the project. Email him with what you need and he will send an estimate.',
  },
  {
    q: 'How does he work with developers?',
    a: 'Closely and early. He started in code, so he designs with real constraints in mind and hands off components, states and edge cases, not just screens.',
  },
  {
    q: 'Does he work with teams outside India?',
    a: 'Yes. He works remotely with teams in the US and UK and plans around the time-zone overlap.',
  },
  {
    q: 'What is his design process?',
    a: 'He starts by understanding the users and the business goal, maps the user flows, sketches wireframes, then moves to high-fidelity UI and prototypes, and builds the design system that keeps it all consistent.',
  },
  {
    q: 'How fast does he reply?',
    a: 'Usually within a day or two by email.',
  },
]
