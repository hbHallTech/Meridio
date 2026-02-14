import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/notifications — List notifications for the current user
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50);
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  const where = {
    userId: session.user.id,
    ...(unreadOnly ? { isRead: false } : {}),
  };

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.notification.count({
      where: { userId: session.user.id, isRead: false },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

// PATCH /api/notifications — Mark notification(s) as read
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await request.json();
  const { notificationId, markAllRead } = body;

  if (markAllRead) {
    await prisma.notification.updateMany({
      where: { userId: session.user.id, isRead: false },
      data: { isRead: true },
    });
    return NextResponse.json({ success: true });
  }

  if (!notificationId) {
    return NextResponse.json({ error: "notificationId requis" }, { status: 400 });
  }

  // Ensure the notification belongs to the user
  const notif = await prisma.notification.findFirst({
    where: { id: notificationId, userId: session.user.id },
  });
  if (!notif) {
    return NextResponse.json({ error: "Notification non trouvée" }, { status: 404 });
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return NextResponse.json({ success: true });
}
