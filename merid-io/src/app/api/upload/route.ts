import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { put } from "@vercel/blob";
import crypto from "crypto";
import path from "path";

const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5MB — Vercel server upload limit
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

// Simple in-memory rate limiter for uploads (per user)
const uploadCounts = new Map<string, { count: number; resetAt: number }>();
const UPLOAD_RATE_LIMIT = 10; // max uploads per window
const UPLOAD_RATE_WINDOW_MS = 60_000; // 1 minute

function checkUploadRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = uploadCounts.get(userId);

  if (!entry || now > entry.resetAt) {
    uploadCounts.set(userId, { count: 1, resetAt: now + UPLOAD_RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= UPLOAD_RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = session.user.id;

  // Rate limiting: prevent upload abuse
  if (!checkUploadRateLimit(userId)) {
    console.warn(`[upload] Rate limit exceeded for user=${userId}`);
    return NextResponse.json(
      { error: "Trop de fichiers uploadés. Veuillez réessayer dans une minute." },
      { status: 429 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    console.warn(`[upload] Rejected file type: user=${userId} file=${file.name} type=${file.type}`);
    return NextResponse.json(
      { error: `Type de fichier non autorisé : ${file.name}. Formats acceptés : PDF, JPG, PNG, GIF, WebP` },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    console.warn(`[upload] Rejected file size: user=${userId} file=${file.name} size=${file.size}`);
    return NextResponse.json(
      { error: `Fichier trop volumineux : ${file.name} (max 4.5 Mo)` },
      { status: 400 }
    );
  }

  try {
    const ext = path.extname(file.name) || (file.type === "application/pdf" ? ".pdf" : ".bin");
    const uniqueName = `attachments/${crypto.randomUUID()}${ext}`;

    const blob = await put(uniqueName, file, {
      access: "public",
      addRandomSuffix: false,
    });

    console.log(`[upload] Success: user=${userId} file=${file.name} size=${file.size} → ${blob.url}`);

    return NextResponse.json({
      url: blob.url,
      name: file.name,
      size: file.size,
      type: file.type,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[upload] Blob storage error: user=${userId} file=${file.name} error=${errMsg}`);

    // Detect common Vercel Blob errors for better user feedback
    if (errMsg.includes("BLOB_STORE_NOT_FOUND") || errMsg.includes("token")) {
      console.error("[upload] BLOB_STORE_NOT_FOUND — BLOB_READ_WRITE_TOKEN may be missing or invalid");
      return NextResponse.json(
        { error: "Service de stockage indisponible. Contactez l'administrateur." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: `Erreur lors de l'upload de ${file.name}` },
      { status: 500 }
    );
  }
}
