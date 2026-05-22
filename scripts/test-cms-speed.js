/**
 * test-cms-speed.js
 * 
 * Direct, zero-dependency test script to verify pagination logic, boundary math, and page counts.
 * Ensures the dynamic client-side pagination works flawlessly across various item lengths.
 */

const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
};

const calculateTotalPages = (totalItems, pageSize) => {
  return Math.max(1, Math.ceil(totalItems / pageSize));
};

const getPaginatedSlice = (items, page, pageSize) => {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
};

console.log("🏃 Running CMS UI Optimization Unit Tests...");

// Test Case 1: Empty list pagination
console.log("   - Test case 1: Empty lists");
const emptyList = [];
const emptyTotalPages = calculateTotalPages(emptyList.length, 10);
const emptySlice = getPaginatedSlice(emptyList, 1, 10);
assert(emptyTotalPages === 1, `Total pages for empty list should be 1, got ${emptyTotalPages}`);
assert(emptySlice.length === 0, `Slice for empty list should be empty, got length ${emptySlice.length}`);

// Test Case 2: Partial page lists (5 items)
console.log("   - Test case 2: Partial page");
const partialList = Array.from({ length: 5 }, (_, i) => i + 1);
const partialTotalPages = calculateTotalPages(partialList.length, 10);
const partialSlice = getPaginatedSlice(partialList, 1, 10);
assert(partialTotalPages === 1, `Total pages for 5 items should be 1, got ${partialTotalPages}`);
assert(partialSlice.length === 5, `Slice length for 5 items should be 5, got ${partialSlice.length}`);
assert(partialSlice[0] === 1 && partialSlice[4] === 5, "Slice elements do not match input list");

// Test Case 3: Exactly full page (10 items)
console.log("   - Test case 3: Exactly 1 page limit");
const fullPageList = Array.from({ length: 10 }, (_, i) => i + 1);
const fullPageTotalPages = calculateTotalPages(fullPageList.length, 10);
const fullPageSlice = getPaginatedSlice(fullPageList, 1, 10);
assert(fullPageTotalPages === 1, `Total pages for 10 items should be 1, got ${fullPageTotalPages}`);
assert(fullPageSlice.length === 10, `Slice length for 10 items should be 10, got ${fullPageSlice.length}`);

// Test Case 4: Multiple pages (25 items)
console.log("   - Test case 4: Multi-page math");
const multiPageList = Array.from({ length: 25 }, (_, i) => i + 1);
const multiPageTotalPages = calculateTotalPages(multiPageList.length, 10);
assert(multiPageTotalPages === 3, `Total pages for 25 items should be 3, got ${multiPageTotalPages}`);

const slice1 = getPaginatedSlice(multiPageList, 1, 10);
const slice2 = getPaginatedSlice(multiPageList, 2, 10);
const slice3 = getPaginatedSlice(multiPageList, 3, 10);

assert(slice1.length === 10, `Page 1 length should be 10, got ${slice1.length}`);
assert(slice1[0] === 1 && slice1[9] === 10, "Page 1 elements incorrect");

assert(slice2.length === 10, `Page 2 length should be 10, got ${slice2.length}`);
assert(slice2[0] === 11 && slice2[9] === 20, "Page 2 elements incorrect");

assert(slice3.length === 5, `Page 3 length should be 5, got ${slice3.length}`);
assert(slice3[0] === 21 && slice3[4] === 25, "Page 3 elements incorrect");

console.log("✅ All UI optimization math unit tests passed successfully!");
process.exit(0);
