import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { put } from "@vercel/blob";
import crypto from "crypto";
import path from "path";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }

  // Validate file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    console.log(`Upload justificatif : ${file.name} → rejeté (type ${file.type})`);
    return NextResponse.json(
      { error: `Type de fichier non autorisé : ${file.name}. Formats acceptés : PDF, JPG, PNG, GIF, WebP` },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    console.log(`Upload justificatif : ${file.name} → rejeté (taille ${file.size})`);
    return NextResponse.json(
      { error: `Fichier trop volumineux : ${file.name} (max 5Mo)` },
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

    console.log(`Upload justificatif : ${file.name} → ${blob.url}`);

    return NextResponse.json({
      url: blob.url,
      name: file.name,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.log(`Upload justificatif : ${file.name} → erreur`, error);
    return NextResponse.json(
      { error: `Erreur lors de l'upload de ${file.name}` },
      { status: 500 }
    );
  }
}
