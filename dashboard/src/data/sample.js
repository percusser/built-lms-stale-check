const COURSE = '7c1e4a52-3b0d-4f6e-9a8b-2d5f0c9e1a01';
const L2 = '7c1e4a52-3b0d-4f6e-9a8b-2d5f0c9e1a12';
const L3 = '7c1e4a52-3b0d-4f6e-9a8b-2d5f0c9e1a13';
const L4 = '7c1e4a52-3b0d-4f6e-9a8b-2d5f0c9e1a14';
const day = (iso) => new Date(`${iso}T15:00:00Z`).getTime();

export const org = { id: 'larkspur', name: 'Larkspur Supply Co.' };

export const learners = [
  ['l-01', 'Maya Okafor', 'Support, Denver'],
  ['l-02', 'Jonah Reyes', 'Support, Denver'],
  ['l-03', 'Priya Natarajan', 'Support, Remote'],
  ['l-04', 'Sam Whitfield', 'Store, Boulder'],
  ['l-05', 'Lena Duarte', 'Support, Remote'],
  ['l-06', 'Theo Brandt', 'Store, Fort Collins'],
  ['l-07', 'Aisha Rahman', 'Support, Denver'],
  ['l-08', 'Diego Morales', 'Store, Boulder'],
  ['l-09', 'Hannah Cole', 'Support, Remote'],
  ['l-10', 'Kenji Watanabe', 'Store, Fort Collins'],
  ['l-11', 'Rosa Lindqvist', 'Support, Denver'],
  ['l-12', 'Marcus Bell', 'Support, Remote'],
].map(([id, name, team]) => ({ id, name, team }));

const completed = (moduleId, entries) => entries.map(([learnerId, date, score]) => ({ moduleId, learnerId, completedAt: day(date), score }));

export const completions = [
  ...completed(L2, [
    ['l-01', '2026-10-12', 100], ['l-02', '2026-10-20', 67], ['l-03', '2026-10-28', 100],
    ['l-04', '2026-11-03', 100], ['l-05', '2026-11-05', 100], ['l-06', '2026-11-09', 67],
    ['l-07', '2026-11-12', 100], ['l-08', '2026-11-16', 100], ['l-09', '2026-11-19', 100],
  ]),
  ...completed(L3, [
    ['l-01', '2026-10-14', 100], ['l-03', '2026-11-01', 100], ['l-04', '2026-11-04', 50],
    ['l-10', '2026-11-18', 100], ['l-11', '2026-11-21', 100],
  ]),
  ...completed(L4, [
    ['l-02', '2026-09-30', 100], ['l-05', '2026-11-08', 100], ['l-07', '2026-11-14', 100], ['l-12', '2026-11-20', 50],
  ]),
];

export const flags = [
  {
    id: 'f-refund-window:7d41c0aa92be',
    factId: 'f-refund-window',
    courseId: COURSE,
    moduleId: L2,
    verdict: 'changed',
    oldValue: '30 days',
    newValue: '14 days',
    quote: 'Customers can return most items for a full refund within 14 days of the delivery date.',
    sourceUrl: 'http://localhost:5050/refunds.html',
    sourceLabel: 'Refund policy, Larkspur wiki',
    origin: 'extension',
    inferenceSource: 'ON_DEVICE',
    status: 'open',
    changedAt: day('2026-11-02'),
    createdAt: day('2026-11-22'),
    createdBy: 'Maya Okafor',
  },
  {
    id: 'f-exchange-where:m-exchanges-in-store',
    factId: 'f-exchange-where',
    courseId: COURSE,
    moduleId: L3,
    verdict: 'changed',
    oldValue: 'in any store or by mail',
    newValue: 'in-store only',
    quote: "Heads up from Legal: from Dec 1, exchanges are in-store only. We're retiring the prepaid mail label for exchanges.",
    sourceLabel: 'Slack screenshot shared from an iPhone',
    origin: 'iphone',
    inferenceSource: 'IN_CLOUD',
    status: 'open',
    changedAt: day('2026-11-17'),
    createdAt: day('2026-11-21'),
    createdBy: 'Rosa Lindqvist',
  },
  {
    id: 'f-refund-manager-approval:m-manager-threshold',
    factId: 'f-refund-manager-approval',
    courseId: COURSE,
    moduleId: L4,
    verdict: 'changed',
    oldValue: 'over $500',
    newValue: 'over $1,000',
    quote: 'Ops update: managers now only need to approve refunds over $1,000.',
    sourceLabel: 'Slack message shared from an iPhone',
    origin: 'iphone',
    inferenceSource: 'ON_DEVICE',
    status: 'open',
    changedAt: day('2026-11-13'),
    createdAt: day('2026-11-20'),
    createdBy: 'Aisha Rahman',
  },
  {
    id: 'f-refund-timing:a19f02c3d4e5',
    factId: 'f-refund-timing',
    courseId: COURSE,
    moduleId: L2,
    verdict: 'removed',
    oldValue: '5 to 7 business days',
    newValue: '',
    quote: '',
    sourceUrl: 'http://localhost:5050/refunds.html',
    sourceLabel: 'Refund policy, Larkspur wiki',
    origin: 'extension',
    inferenceSource: 'ON_DEVICE',
    status: 'dismissed',
    changedAt: day('2026-10-20'),
    createdAt: day('2026-10-21'),
    createdBy: 'Jonah Reyes',
  },
];

export const drafts = {
  'f-refund-window:7d41c0aa92be': {
    flagId: 'f-refund-window:7d41c0aa92be',
    inferenceSource: 'IN_CLOUD',
    createdAt: day('2026-11-22'),
    changeSummary: 'The return window drops from 30 days to 14 days. One paragraph and one quiz question change. The quiz question flips: boots delivered 20 days ago are now outside the window.',
    blocks: [
      {
        blockId: 'ParagraphBlock-l2-window',
        propName: 'text',
        html: '<p>Customers can return most items for a full refund within <strong>14 days</strong> of the delivery date. Ask for proof of purchase: the receipt, the order number, or the card they paid with. The item must be resalable, with its tags attached.</p>',
      },
    ],
    quizQuestions: [
      {
        blockId: 'SimpleQuizBlock-l2-quiz',
        id: 'q-l2-window',
        question: 'A customer wants a refund for boots delivered 20 days ago. What do you tell them?',
        options: ['The return window has closed', 'They can return the boots for a full refund', 'They can get store credit only', 'They need a manager to approve it'],
        correctAnswer: 'The return window has closed',
        feedback: 'Customers have 14 days from delivery to return most items for a full refund.',
      },
    ],
    correctionNotice: 'The refund lesson in Returns 101 said customers have 30 days to return an item. Legal changed the policy on November 2: the window is now 14 days from delivery. If a customer asks about a return between day 15 and day 30, the return window has closed. The lesson and its quiz are updated.',
  },
};
