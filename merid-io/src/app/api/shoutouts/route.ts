import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyShoutoutReceived } from "@/lib/notifications";

/**
 * POST /api/shoutouts
 * Send a shoutout to a colleague. Any authenticated user can send.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { toUserId, message } = body;

    if (!toUserId || !message) {
      return NextResponse.json({ error: "Champs requis : toUserId, message" }, { status: 400 });
    }

    if (message.length > 500) {
      return NextResponse.json({ error: "Message trop long (max 500)" }, { status: 400 });
    }

    if (toUserId === session.user.id) {
      return NextResponse.json({ error: "Vous ne pouvez pas vous envoyer un shoutout" }, { status: 400 });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true, isActive: true },
    });
    if (!targetUser || !targetUser.isActive) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const shoutout = await prisma.shoutout.create({
      data: {
        fromUserId: session.user.id,
        toUserId,
        message,
      },
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true } },
        toUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Notify recipient (non-blocking)
    const senderName = `${shoutout.fromUser.firstName} ${shoutout.fromUser.lastName}`;
    void notifyShoutoutReceived(toUserId, {
      shoutoutId: shoutout.id,
      senderName,
      message,
    }).catch((err) => {
      console.error("[shoutouts] notification error:", err);
    });

    return NextResponse.json(shoutout, { status: 201 });
  } catch (err) {
    console.error("[shoutouts] POST error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
