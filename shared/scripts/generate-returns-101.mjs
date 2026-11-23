import { writeFileSync, mkdirSync } from 'node:fs';
const out = process.argv[2] ?? new URL('../fixtures/returns-101', import.meta.url).pathname;
mkdirSync(`${out}/modules`, { recursive: true });
const WIKI = 'http://localhost:5050';
const course = { id: '7c1e4a52-3b0d-4f6e-9a8b-2d5f0c9e1a01', title: 'Returns 101', description: 'How Larkspur Supply Co. support handles refunds, exchanges and escalations.' };
const pad = { top: 'md', bottom: 'md' };
const base = { widthConstraint: 'medium', padding: pad, elementStyles: {} };
const H = (id, text, level = 2) => ({ block_id: `HeadingBlock-${id}`, type: 'HeadingBlock', props: { ...base, level, text } });
const P = (id, text) => ({ block_id: `ParagraphBlock-${id}`, type: 'ParagraphBlock', props: { ...base, widthConstraint: 'narrow', text } });
const C = (id, variant, title, content) => ({ block_id: `CalloutBlock-${id}`, type: 'CalloutBlock', props: { ...base, variant, title, content, showIcon: true } });
const L = (id, items) => ({ block_id: `ListBlock-${id}`, type: 'ListBlock', props: { ...base, type: 'ul', items: items.map((text) => ({ text })) } });
const Q = (id, title, questions) => ({ block_id: `SimpleQuizBlock-${id}`, type: 'SimpleQuizBlock', props: { ...base, title, description: '', questions, allowRetakes: true, showFeedback: true, randomizeQuestions: false, passingScore: 80, presentationMode: 'one-by-one', showFeedbackPerQuestion: true, quizStyle: {} } });
const mc = (id, question, options, correctAnswer, feedback) => ({ id, type: 'multiple-choice', question, points: 1, options, correctAnswer, feedback });

const modules = [
  { id: '7c1e4a52-3b0d-4f6e-9a8b-2d5f0c9e1a11', title: 'Lesson 1: How we handle returns', blocks: [
    H('l1-heading', 'How we handle returns', 1),
    P('l1-intro', '<p>Every return starts with one question: is the customer asking for their money back, or for a different item? Money back is a <strong>refund</strong>. A different item is an <strong>exchange</strong>. If you cannot solve the problem yourself, you <strong>escalate</strong>.</p><p>This course covers all three. Each lesson follows the matching page in the support wiki.</p>'),
  ] },
  { id: '7c1e4a52-3b0d-4f6e-9a8b-2d5f0c9e1a12', source: '/refunds.html', title: 'Lesson 2: Refunds', blocks: [
    H('l2-heading', 'Refunds'),
    P('l2-window', '<p>Customers can return most items for a full refund within <strong>30 days</strong> of the delivery date. Ask for proof of purchase: the receipt, the order number, or the card they paid with. The item must be resalable, with its tags attached.</p>'),
    C('l2-no-receipt', 'info', 'No proof of purchase?', '<p>Offer store credit for the current selling price instead of a refund.</p>'),
    P('l2-payment', '<p>Refunds go back to the original payment method. The customer sees the money within <strong>5 to 7 business days</strong> after we receive the item. Original shipping costs are not refunded, unless the item arrived damaged or we sent the wrong item.</p>'),
    H('l2-nonreturnable-heading', 'Items that cannot be returned', 3),
    L('l2-nonreturnable', ['Gift cards', 'Custom-cut rope and chain', 'Opened fuel canisters']),
    Q('l2-quiz', 'Check your knowledge: refunds', [
      mc('q-l2-window', 'A customer wants a refund for boots delivered 20 days ago. What do you tell them?', ['The return window has closed', 'They can return the boots for a full refund', 'They can get store credit only', 'They need a manager to approve it'], 'They can return the boots for a full refund', 'Customers have 30 days from delivery to return most items for a full refund.'),
      mc('q-l2-no-receipt', 'A customer has no receipt, no order number and paid cash. What can you offer?', ['A full cash refund', 'Store credit for the current selling price', 'Nothing', 'An exchange only'], 'Store credit for the current selling price'),
      mc('q-l2-timing', 'How long until a refund reaches the customer after we receive the item?', ['Same day', '1 to 2 business days', '5 to 7 business days', '30 days'], '5 to 7 business days'),
    ]),
  ] },
  { id: '7c1e4a52-3b0d-4f6e-9a8b-2d5f0c9e1a13', source: '/exchanges.html', title: 'Lesson 3: Exchanges', blocks: [
    H('l3-heading', 'Exchanges'),
    P('l3-where', '<p>Customers can exchange an item <strong>in any store or by mail</strong>. For a mail exchange, email the customer a prepaid return label from the order page.</p>'),
    P('l3-price', '<p>Exchanges follow the same window as refunds. If the new item costs more, the customer pays the difference. If it costs less, refund the difference to the original payment method.</p>'),
    C('l3-once', 'warning', 'One exchange per item', '<p>Each purchased item can be exchanged once. Handle a second exchange as a return and a new purchase.</p>'),
    Q('l3-quiz', 'Check your knowledge: exchanges', [
      mc('q-l3-where', 'A customer lives two hours from the nearest store and wants a different size. What do you offer?', ['They must visit a store', 'A mail exchange with a prepaid return label', 'A refund only', 'Store credit'], 'A mail exchange with a prepaid return label', 'Customers can exchange in any store or by mail.'),
      mc('q-l3-second', 'A customer wants to exchange a jacket they already exchanged once. What do you do?', ['Exchange it again', 'Refuse', 'Handle it as a return and a new purchase', 'Escalate to Tier 2'], 'Handle it as a return and a new purchase'),
    ]),
  ] },
  { id: '7c1e4a52-3b0d-4f6e-9a8b-2d5f0c9e1a14', source: '/escalation.html', title: 'Lesson 4: Escalating to Tier 2', blocks: [
    H('l4-heading', 'Escalating to Tier 2'),
    P('l4-when', '<p>You own the ticket first. Escalate to <strong>Tier 2 after two failed fixes</strong>: two different troubleshooting steps that did not solve the problem. If the customer reports a safety issue with a product, escalate right away without trying fixes first.</p>'),
    { block_id: 'ProcessFlowBlock-l4-how', type: 'ProcessFlowBlock', props: { ...base, widthConstraint: 'wide', title: 'How to escalate', enableAnimations: true, animationSpeed: 0.5, steps: [
      { title: 'Tag it', description: 'Set the ticket priority and add the tag tier2.', icon: '🏷️' },
      { title: 'Write the handoff', description: 'What the customer reported, both fixes you tried, and what happened.', icon: '📝' },
      { title: 'Tell the customer', description: 'A specialist will take over, and when they will hear back.', icon: '💬' },
    ] } },
    { block_id: 'KeyTakeawaysBlock-l4-targets', type: 'KeyTakeawaysBlock', props: { ...base, intro: '<p>Remember these numbers.</p>', hook: '', showIcons: true, items: [
      { icon: '⏱️', content: '<p>Tier 2 answers a standard escalation within 4 business hours.</p>' },
      { icon: '⚠️', content: '<p>Tier 2 answers a safety escalation within 1 hour, any time of day.</p>' },
      { icon: '💵', content: '<p>Refunds over $500 need a support manager to approve them before they are issued.</p>' },
    ] } },
    Q('l4-quiz', 'Check your knowledge: escalation', [
      mc('q-l4-when', 'When should you escalate a standard ticket to Tier 2?', ['Right away', 'After one failed fix', 'After two failed fixes', 'After the customer asks twice'], 'After two failed fixes'),
      mc('q-l4-refund', 'A customer is owed a $650 refund. What happens before it is issued?', ['Nothing, issue it', 'A support manager approves it', 'Tier 2 approves it', 'The customer signs a form'], 'A support manager approves it'),
    ]),
  ] },
];

const sourceMap = {};
for (const m of modules) {
  const data = m.blocks.map((b, index) => ({ ...b, location: { parent_block_id: null, slot: null, index } }));
  writeFileSync(`${out}/modules/${m.id}.blocks.json`, JSON.stringify({ data, meta: { total: data.length } }, null, 2) + '\n');
  if (m.source) for (const b of m.blocks) sourceMap[b.block_id] = `${WIKI}${m.source}`;
}
writeFileSync(`${out}/course.json`, JSON.stringify({ ...course, modules: modules.map((m, i) => ({ id: m.id, title: m.title, sequence_order: i + 1, blocks: `modules/${m.id}.blocks.json` })) }, null, 2) + '\n');
writeFileSync(`${out}/source-map.json`, JSON.stringify({ wikiBase: WIKI, blocks: sourceMap }, null, 2) + '\n');
