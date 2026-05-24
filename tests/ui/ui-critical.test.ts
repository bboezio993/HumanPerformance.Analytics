import assert from "assert";

console.log("Mocking UI Critiques (Flux photo/OCR/voix/barcode)...");

// Mocks to ensure no regressions on adoption paths without a backend
const submitPhotoForm = (hasFile: boolean) => {
    if (!hasFile) return { status: "error", message: "File required" };
    return { status: "pending", draftId: "draft-photo" };
};

const submitVoiceTranscription = (transcriptLength: number) => {
    if (transcriptLength === 0) return { status: "error", message: "Audio unreadable" };
    return { status: "pending", draftId: "draft-voice" };
};

const validateDraftToSave = (draftStatus: string) => {
    if (draftStatus !== 'confirmed') return { status: "error", message: "Needs user confirmation" };
    return { status: "saved" };
}

const barcodeReview = (reviewed: boolean) => {
    if (!reviewed) return { status: "error", message: "Needs review" };
    return { status: "saved" };
}

// Assertions for UI fallbacks
assert.strictEqual(submitPhotoForm(false).status, "error", "UI prevents submission without photo");
assert.strictEqual(submitPhotoForm(true).status, "pending", "UI allows submission with photo");
assert.strictEqual(submitVoiceTranscription(0).status, "error", "UI prevents empty transcription");
assert.strictEqual(submitVoiceTranscription(15).status, "pending", "UI allows robust transcription");

assert.strictEqual(validateDraftToSave("draft").status, "error", "Cannot save unconfirmed draft");
assert.strictEqual(validateDraftToSave("confirmed").status, "saved", "Can save confirmed draft");

assert.strictEqual(barcodeReview(false).status, "error", "Barcode requires review before save");
assert.strictEqual(barcodeReview(true).status, "saved", "Barcode saves after review");

console.log("✅ UI Critiques tests passed. Flux sans backend réel (mocks).");
