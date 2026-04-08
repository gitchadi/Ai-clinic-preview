import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const region = process.env.AWS_REGION;
const bucket = process.env.AWS_S3_BUCKET;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const publicBaseUrl = process.env.AWS_S3_PUBLIC_BASE_URL;

const s3 =
  region && accessKeyId && secretAccessKey
    ? new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      })
    : null;

function getFileUrl(key: string) {
  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/$/, "")}/${key}`;
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export async function POST(request: Request) {
  try {
    if (!region || !bucket || !accessKeyId || !secretAccessKey || !s3) {
      return NextResponse.json(
        { error: "AWS S3 environment variables are not fully configured." },
        { status: 500 },
      );
    }

    const body = await request.json();
    const filename =
      typeof body?.filename === "string" ? body.filename.trim() : "";
    const contentType =
      typeof body?.contentType === "string" ? body.contentType.trim() : "";

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "Both filename and contentType are required." },
        { status: 400 },
      );
    }

    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
    const key = `clinic-previews/${crypto.randomUUID()}-${safeFilename}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 60 * 5,
    });

    return NextResponse.json({
      uploadUrl,
      fileUrl: getFileUrl(key),
      key,
    });
  } catch (error) {
    console.error("S3 upload URL generation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate a secure upload URL.",
      },
      { status: 500 },
    );
  }
}
