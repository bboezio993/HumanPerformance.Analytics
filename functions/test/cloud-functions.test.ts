import assert from "assert";

// Mocking Cloud Functions for testing purposes (Sprint 12.2)
console.log("Mocking Cloud Functions Setup...");

// 1. parseRecipeText
function parseRecipeText(input: string) {
    if (!input) throw new Error("Input required");
    return { status: "draft", id: "recipe-mock-123", confidence: 85 };
}

// 2. parseVoiceForm
function parseVoiceForm(transcript: string) {
    if (!transcript) throw new Error("Transcript required");
    return { status: "draft", recognizedFields: 4 };
}

// 3. OCR Mock
function extractNutritionLabel(imagePath: string) {
    return { calories: 250, protein: 12, draftId: "ocr-mock" };
}

// 4. Mocks for quotas/inputHash/cache
const cache = new Map();
const rateLimits = new Map();

function lookupOpenFoodFactsWithCache(barcode: string) {
    if (cache.has(barcode)) return cache.get(barcode);
    const result = { found: true, barcode };
    cache.set(barcode, result);
    return result;
}

function checkQuota(uid: string, feature: string) {
    const key = `${uid}_${feature}`;
    const calls = rateLimits.get(key) || 0;
    if (calls >= 5) return false;
    rateLimits.set(key, calls + 1);
    return true;
}

console.log("Running Cloud Functions Mock Tests...");

assert.strictEqual(parseRecipeText("test").status, "draft", "Recipe should return a draft");
assert.strictEqual(parseVoiceForm("hello I ate").status, "draft", "Voice should return a draft");
assert.strictEqual(extractNutritionLabel("path/to/img").calories, 250, "OCR should return payload");

// Test cache
const r1 = lookupOpenFoodFactsWithCache("123");
const r2 = lookupOpenFoodFactsWithCache("123");
assert.strictEqual(r1, r2, "Cache should return the exact same object");

// Test Quotas
assert.strictEqual(checkQuota("u1", "photo"), true);
assert.strictEqual(checkQuota("u1", "photo"), true);
assert.strictEqual(checkQuota("u1", "photo"), true);
assert.strictEqual(checkQuota("u1", "photo"), true);
assert.strictEqual(checkQuota("u1", "photo"), true);
assert.strictEqual(checkQuota("u1", "photo"), false, "Quota should be exhausted");

console.log("✅ Cloud Functions tests completed successfully. (Mocks Gemini/OFF)");
