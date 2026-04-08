# AI Clinic Preview

`ai-clinic-preview` is a Next.js 16 app for aesthetic and dental clinics. It lets a user upload a patient photo, choose a cosmetic treatment preview, and generate a side-by-side before/after visualization using an AI image model.

## What The Project Does

The product is a premium consultation preview flow:

- Upload a portrait photo from the browser
- Generate a secure presigned upload URL from the backend
- Upload the original image directly to Amazon S3
- Send the uploaded image URL plus the selected treatment type to the generation API
- Run an AI image transformation through Replicate
- Show the result in an interactive before/after slider

The current supported treatment previews are:

- `whitening`: subtle cosmetic dental whitening
- `alignment`: subtle orthodontic alignment preview
- `skin`: subtle skin rejuvenation preview

## Stack

- `Next.js 16.2.2`
- `React 19.2.4`
- `TypeScript`
- `Tailwind CSS 4`
- `AWS S3` for image storage and presigned uploads
- `Replicate` for AI image generation
- `lucide-react` for icons
- `react-compare-slider` for the before/after UI

## Main User Experience

The landing page is implemented in [src/app/page.tsx](/home/monir/ai-clinic-preview/src/app/page.tsx).

It includes:

- A premium clinic-style hero section
- Treatment cards for whitening, alignment, and skin refresh
- Drag-and-drop or click-to-upload image selection
- Toast notifications for success and error states
- Loading-state messaging while upload/generation is in progress
- A before/after comparison panel for generated results
- A consultation CTA section

## Backend Flow

### 1. Upload API

The upload endpoint lives at [src/app/api/upload/route.ts](/home/monir/ai-clinic-preview/src/app/api/upload/route.ts).

Responsibilities:

- Validates `filename` and `contentType`
- Sanitizes the filename
- Generates a unique S3 object key under `clinic-previews/`
- Creates a presigned `PUT` URL with AWS SDK
- Returns:
  - `uploadUrl`
  - `fileUrl`
  - `key`

The browser then uploads the file directly to S3 using the returned presigned URL.

### 2. Generate API

The generation endpoint lives at [src/app/api/generate/route.ts](/home/monir/ai-clinic-preview/src/app/api/generate/route.ts).

Responsibilities:

- Validates `imageUrl` and `treatmentType`
- Maps the selected treatment to a prompt from [src/lib/prompts.ts](/home/monir/ai-clinic-preview/src/lib/prompts.ts)
- Calls Replicate using the model `black-forest-labs/flux-schnell`
- Uses `prompt_strength: 0.35`
- Extracts the generated image URL from multiple possible response shapes
- Returns `outputUrl`

## Prompt Design

The treatment prompts are defined in [src/lib/prompts.ts](/home/monir/ai-clinic-preview/src/lib/prompts.ts).

Prompt design goals:

- Keep edits subtle and realistic
- Preserve patient identity
- Preserve lighting, background, and face structure
- Avoid changing unrelated facial features
- Keep outputs clinically believable rather than exaggerated

## UI Component Structure

### App Shell

- [src/app/layout.tsx](/home/monir/ai-clinic-preview/src/app/layout.tsx): root layout and metadata
- [src/app/globals.css](/home/monir/ai-clinic-preview/src/app/globals.css): Tailwind import, theme tokens, base typography/colors

### Reusable Component

- [src/components/BeforeAfterSlider.tsx](/home/monir/ai-clinic-preview/src/components/BeforeAfterSlider.tsx): wraps `react-compare-slider` with custom before/after labels and handle styling

## Project Structure

```text
src/
  app/
    api/
      generate/route.ts
      upload/route.ts
    favicon.ico
    globals.css
    layout.tsx
    page.tsx
  components/
    BeforeAfterSlider.tsx
  lib/
    prompts.ts
public/
  file.svg
  globe.svg
  next.svg
  vercel.svg
  window.svg
```

## Configuration

Main config files:

- [package.json](/home/monir/ai-clinic-preview/package.json)
- [next.config.ts](/home/monir/ai-clinic-preview/next.config.ts)
- [tsconfig.json](/home/monir/ai-clinic-preview/tsconfig.json)
- [postcss.config.mjs](/home/monir/ai-clinic-preview/postcss.config.mjs)
- [AGENTS.md](/home/monir/ai-clinic-preview/AGENTS.md)

Current npm scripts:

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

## Required Environment Variables

The app expects these environment variables:

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_BUCKET`
- `AWS_S3_PUBLIC_BASE_URL`
- `REPLICATE_API_TOKEN`

Example:

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
AWS_S3_PUBLIC_BASE_URL=https://your-bucket.s3.us-east-1.amazonaws.com
REPLICATE_API_TOKEN=your-replicate-token
```

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Add a `.env.local` file with the required environment variables.

3. Start the dev server:

```bash
npm run dev
```

4. Open `http://localhost:3000`

## Current Behavior Notes

- The app uses client-side object URLs for local preview before upload.
- The original preview is reset when the user changes treatment or selects a new image.
- Upload and generation are split into two separate backend calls.
- The backend runs on the Node.js runtime, not the edge runtime.
- The app uses `force-dynamic` for both API routes.

## Current Limitations And Risks

- [src/app/layout.tsx](/home/monir/ai-clinic-preview/src/app/layout.tsx) still has default metadata (`Create Next App`), so SEO and branding are unfinished.
- [next.config.ts](/home/monir/ai-clinic-preview/next.config.ts) is effectively empty.
- There is no persistence layer or patient/session history.
- There is no authentication or staff/admin access control.
- There is no file-size validation, dimension validation, or MIME verification beyond a browser-side image check.
- There is no rate limiting or abuse protection on the APIs.
- There is no webhook or async job handling; generation is synchronous from the browser's perspective.
- There are no automated tests yet.
- The CTA buttons do not currently submit a form or navigate to a booking flow.

## Security Note

The repository currently contains a populated `.env.local` file in the workspace. Secrets should not be committed or shared in documentation. If those credentials have been exposed outside a secure local environment, they should be rotated.

## Improvement Opportunities

- Replace default metadata with clinic-specific title and description
- Add stronger upload validation and max-size enforcement
- Add loading/error telemetry and structured logging
- Add auth and protected staff workflows
- Store generation history and patient sessions
- Add downloadable consultation assets such as PDF summaries
- Connect the consultation CTA to a real booking workflow
- Add automated tests for API validation and UI flows

## Summary

This project is already a functional AI-powered clinic preview demo with a polished front end, S3 upload pipeline, treatment-specific prompting, and generated before/after presentation. The main remaining work is around production hardening: security, validation, branding, persistence, and operational controls.
