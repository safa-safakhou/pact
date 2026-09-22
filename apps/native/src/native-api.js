// Metro does not map an explicit `.js` import to TypeScript the way NodeNext does.
// Keep this tiny bridge so the app and the repository's NodeNext typecheck agree.
export * from "./native-api.ts";
