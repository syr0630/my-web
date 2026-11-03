import { requireAdminSession } from "@/lib/admin/auth";
import { deleteFeedback, getFeedback, updateFeedback } from "@/lib/feedback/db";
import {
  isFeedbackStatus,
  type FeedbackStatus,
} from "@/lib/feedback/types";
import { parseAdminNote } from "@/lib/feedback/validation";
import { readJsonObject } from "@/lib/ai/validate";
import { AppError, errorResponse, jsonHeaders, makeRequestId } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function notFound(): never {
  throw new AppError({
    message: "反馈记录不存在或已被删除。",
    error_code: "FEEDBACK_NOT_FOUND",
    status: 404,
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const requestId = makeRequestId();

  try {
    await requireAdminSession();
    const { id } = await context.params;
    const feedback = getFeedback(id);
    if (!feedback) notFound();
    return Response.json({ feedback }, { headers: jsonHeaders(requestId) });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = makeRequestId();

  try {
    await requireAdminSession();
    const { id } = await context.params;
    const body = await readJsonObject(request);

    if (body.status === undefined && !("admin_note" in body)) {
      throw new AppError({
        message: "没有需要更新的字段。",
        error_code: "INVALID_PATCH",
        status: 400,
      });
    }

    let status: FeedbackStatus | undefined;
    if (body.status !== undefined) {
      if (!isFeedbackStatus(body.status)) {
        throw new AppError({
          message: "处理状态无效。",
          error_code: "INVALID_STATUS",
          status: 400,
        });
      }
      status = body.status;
    }

    const adminNote = "admin_note" in body ? parseAdminNote(body.admin_note) : undefined;
    const feedback = updateFeedback(id, {
      ...(status ? { status } : {}),
      ...(adminNote !== undefined ? { admin_note: adminNote } : {}),
    });

    if (!feedback) notFound();
    return Response.json({ feedback }, { headers: jsonHeaders(requestId) });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const requestId = makeRequestId();

  try {
    await requireAdminSession();
    const { id } = await context.params;
    if (!deleteFeedback(id)) notFound();
    return Response.json(
      { ok: true, request_id: requestId },
      { headers: jsonHeaders(requestId) }
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
}