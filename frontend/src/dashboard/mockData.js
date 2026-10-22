export const CATEGORIES = ['Food', 'Office', 'Travel', 'Other']

// Fake data until the backend has GET /api/receipts.
// status: 'done' | 'processing' | 'review'
export const MOCK_RECEIPTS = [
  {
    id: 1,
    date: '2026-10-14',
    merchant: 'Maple Street Office Supply',
    category: 'Office',
    status: 'review',
    reviewReason: 'Items don’t add up to subtotal',
    // Mirrors the real Dolphin output for test_images/sample_receipt_clean.png,
    // which dropped the Shipping Labels line total
    items: [
      { name: 'Printer Paper 500ct', qty: 2, total: 16.98 },
      { name: 'Black Ink Cartridge', qty: 1, total: 34.99 },
      { name: 'Shipping Labels 100', qty: 1, total: null },
      { name: 'Packing Tape 3pk', qty: 1, total: 9.29 },
      { name: 'Ballpoint Pens 12pk', qty: 3, total: 12.57 },
    ],
    subtotal: 86.58,
    tax: 6.06,
    total: 92.64,
  },
  {
    id: 2,
    date: '2026-10-12',
    merchant: 'Chipotle',
    category: 'Food',
    status: 'done',
    items: [
      { name: 'Chicken Burrito Bowl', qty: 1, total: 11.25 },
      { name: 'Chips & Guac', qty: 1, total: 2.0 },
    ],
    subtotal: 13.25,
    tax: 1.0,
    total: 14.25,
  },
  { id: 3, date: '2026-10-11', merchant: 'Uber', category: 'Travel', total: 23.1, status: 'done' },
  { id: 4, date: '2026-10-09', merchant: 'Target', category: 'Other', total: 61.02, status: 'review', reviewReason: 'Total unclear' },
  { id: 5, date: '2026-10-08', merchant: 'Staples', category: 'Office', total: 118.76, status: 'done' },
  { id: 6, date: '2026-10-06', merchant: 'Panera Bread', category: 'Food', total: 38.4, status: 'done' },
  { id: 7, date: '2026-10-04', merchant: 'Delta Air Lines', category: 'Travel', total: 63.0, status: 'done' },
  { id: 8, date: '2026-10-02', merchant: 'Trader Joe’s', category: 'Food', total: 87.35, status: 'done' },
  { id: 9, date: '2026-09-27', merchant: 'Amazon', category: 'Office', total: 145.2, status: 'done' },
  { id: 10, date: '2026-09-20', merchant: 'Shell', category: 'Travel', total: 52.18, status: 'done' },
  { id: 11, date: '2026-09-14', merchant: 'Chipotle', category: 'Food', total: 13.9, status: 'done' },
  { id: 12, date: '2026-09-03', merchant: 'Best Buy', category: 'Other', total: 219.99, status: 'done' },
]
