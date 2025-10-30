<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Hybrid deployment responsibilities

The application operates in a hybrid model: Firebase handles authentication and realtime exam attempts, while Google Apps Script (GAS) keeps the canonical exam metadata (students, classes, exams, exam windows and generated variants). The table below summarizes the tasks that must be performed in each environment when you roll out a new release or synchronize data.

| Area | Tasks | Where to perform |
| --- | --- | --- |
| Script configuration | Update script properties such as `CONFIG.SPREADSHEET_ID`, `GCS.PUBLIC_BUCKET`, `GCS.PRIVATE_BUCKET`, service-account email/key, and Firebase project ID so the GAS runtime can access spreadsheets and Google Cloud Storage. | GAS → **Project Settings → Script Properties**. |
| Metadata management | Maintain the master spreadsheets (`QBank`, `Classes`, `Exams`, `Students`, `Windows`). All student profiles and class memberships must live here for login to succeed, because the frontend calls `getUserProfileByEmail` through the GAS endpoint. | Google Sheets connected to the GAS project. |
| Variant generation | Trigger `syncAndCreateSnapshots` (from the admin UI or the Apps Script IDE) to create/update exam variant snapshots and answer keys in Cloud Storage. Confirm the public bucket contains files named `EXAMID_variant-XX_snapshot.json`. | GAS web app (via `runSyncAndCreateSnapshots`) or Apps Script IDE. |
| API deployment | After code or property changes, deploy a new **Web app** version and copy the deployment URL into `services/examService.ts` (`SCRIPT_URL`). The frontend helper `gasApiRequest` sends all admin and student metadata calls to this URL. | GAS → **Deploy → Manage deployments** and project source. |
| Authentication & roles | Create admin accounts and assign the `role: admin` custom claim. Student accounts created from the CSV importer will land in Firebase Auth; ensure they also exist in the `Students` sheet so `getUserProfileByEmail` succeeds. | Firebase Console → **Authentication** (users + custom claims). |
| Firestore data | Review realtime attempt data (`attempts`, `auditLogs`) and ensure the Cloud Functions (`bulkCreateUsers`, `generateExamVariants`) are deployed. These functions support the admin importer and server-side variant generation used by the web app. | Firebase Console → **Firestore**, **Functions**. |

### Typical release checklist

1. **GAS**: Push Apps Script updates, verify script properties, deploy a new web app version, and confirm the deployment URL matches `SCRIPT_URL` in `services/examService.ts`.
2. **Google Sheets**: Refresh the `Students` sheet for any new imports so GAS can recognize student logins, then update `Classes`, `Exams`, and `Windows` as needed.
3. **Firebase Console**: Import or create new Firebase Authentication users, set admin claims if necessary, and deploy Cloud Functions updates (if any).
4. **Variants**: Run `syncAndCreateSnapshots` to regenerate exam variants and validate Cloud Storage access with the `testGcsRoundTrip` GAS action if bucket settings changed.
5. **Smoke test**: From the web app, log in as a student to ensure the dashboard loads via GAS (`getAvailableWindowsForUser`) and start an exam to verify variant retrieval (`getExamVariantForStudent`).